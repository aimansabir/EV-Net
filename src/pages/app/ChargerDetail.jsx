import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, Marker } from 'react-leaflet';
import BaseMapTiles from '../../components/ui/BaseMapTiles';
import L from 'leaflet';
import { listingService, availabilityService, bookingService } from '../../data/api';
import { makePageCacheKey, PAGE_CACHE_TTL, useCachedPageData } from '../../store/pageCacheStore';
import {
  calculateEnergyBookingFees,
  getPricingBand,
  formatPKR,
  VEHICLE_SIZES,
  ENERGY_BY_SIZE,
  PRICING_BAND,
  calculateBookingFees
} from '../../data/feeConfig';
import DatePicker from 'react-datepicker';
import {
  Calendar, MapPin, ArrowLeft, Lock, Unlock, ExternalLink, ShieldCheck,
  ChevronDown, Clock, Timer, MessageSquare, Wifi, Video, ParkingCircle,
  Droplets, User, Shield, Utensils, Trees, Moon, Zap, ShoppingBag,
  Lightbulb, Waves, Coffee, Milestone, Smartphone, CheckCircle, RefreshCw
} from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import useAuthStore from '../../store/authStore';
import { canBook, exactLocationUnlocked as checkLocationUnlocked, canCreateInquiry } from '../../utils/accessControl';
import { messagingService } from '../../data/api';
import { getFuzzyCoordinates } from '../../data/cityCoordinates';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/calendar.css';
import '../../styles/reserve.css';
import 'leaflet/dist/leaflet.css';

const smallIcon = new L.DivIcon({ className: 'custom-map-marker', html: `<div class="marker-pin"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

const formatTime12h = (time24) => {
  if (!time24 || !time24.includes(':')) return time24 || 'Select';
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour; // handle 00:00 and 12:00
  return `${hour}:${minuteStr} ${ampm}`;
};

const VEHICLE_LABELS = {
  SMALL: { name: 'Small car', hint: 'Hatchbacks and compact city EVs' },
  MEDIUM: { name: 'Mid-size', hint: 'Sedans, crossovers and compact SUVs' },
  LARGE: { name: 'Large SUV', hint: 'Full-size SUVs, pickups and luxury EVs' },
};

const ChargerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [selectedStart, setSelectedStart] = useState('');
  const [duration, setDuration] = useState(2);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [vehicleSize, setVehicleSize] = useState(VEHICLE_SIZES.SMALL);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const { user } = useAuthStore();
  const userId = user?.id;
  const [noSlotsReason, setNoSlotsReason] = useState(''); // 'past', 'none', or ''
  const [slotsLoading, setSlotsLoading] = useState(false);

  const listingCacheKey = makePageCacheKey('charger-detail', id);
  const fetchListing = useCallback(() => listingService.getById(id), [id]);
  const {
    data: listing,
    isLoading: loading,
    isRefreshing: listingRefreshing,
    error: listingLoadError,
    refresh: refreshListing,
  } = useCachedPageData(listingCacheKey, fetchListing, {
    enabled: !!id,
    ttl: PAGE_CACHE_TTL.LONG,
  });

  const userBookingsCacheKey = makePageCacheKey('user-bookings', userId);
  const fetchUserBookings = useCallback(() => bookingService.getByUser(userId), [userId]);
  const {
    data: cachedUserBookings,
    error: bookingsLoadError,
  } = useCachedPageData(userBookingsCacheKey, fetchUserBookings, {
    enabled: !!userId,
    ttl: PAGE_CACHE_TTL.SHORT,
  });
  const userBookings = cachedUserBookings || [];

  useEffect(() => {
    setSelectedImage(0);
  }, [id]);

  useEffect(() => {
    if (listing?.images?.length && selectedImage >= listing.images.length) {
      setSelectedImage(0);
    }
  }, [listing?.images?.length, selectedImage]);

  useEffect(() => {
    let mounted = true;
    const loadSlots = async () => {
      if (!listing?.id) return;
      try {
        setSlotsLoading(true);
        const dateStr = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
        const daySlots = await availabilityService.generateSlots(id, dateStr);
        
        // Filter out past slots for today
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isToday = dateStr === todayStr;
        const currentHour = now.getHours();

        const validSlots = isToday 
          ? daySlots.filter(s => parseInt(s.startTime.split(':')[0]) > currentHour)
          : daySlots;

        if (!mounted) return;
        setSlots(validSlots);
        
        // Debug info for message
        if (daySlots.length > 0 && validSlots.length === 0 && isToday) {
          setNoSlotsReason('past');
        } else if (daySlots.length === 0) {
          setNoSlotsReason('none');
        } else {
          setNoSlotsReason('');
        }
        
        // Pre-select first available future slot
        const firstAvail = validSlots.find(s => !s.isBooked);
        if (firstAvail) {
          setSelectedStart(firstAvail.startTime);
        } else {
          setSelectedStart('');
        }
      } catch (err) {
        console.error("Failed to load availability:", err);
        if (mounted) {
          setSlots([]);
          setNoSlotsReason('none');
        }
      } finally {
        if (mounted) setSlotsLoading(false);
      }
    };
    loadSlots();
    return () => {
      mounted = false;
    };
  }, [id, listing?.id, selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-dropdown-container')) {
        setIsStartOpen(false);
        setIsDurationOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadErrorMessage = listingLoadError?.message || 'Could not load charger details.';

  // Only claim availability we can actually see in the loaded slots.
  const isSelectedDateToday = (() => {
    const d = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    return d.toDateString() === new Date().toDateString();
  })();
  const hasOpenSlots = slots.some(slot => !slot.isBooked);
  const availabilityChip = slotsLoading
    ? null
    : hasOpenSlots
      ? { label: isSelectedDateToday ? 'Available today' : 'Available', tone: 'ok' }
      : { label: 'Fully booked', tone: 'warn' };

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if (!listing) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}><div>{loadErrorMessage || 'Listing not found'}</div><button className="btn btn-secondary" onClick={() => refreshListing({ force: true, silent: false })} style={{ marginTop: '1rem' }}>Retry</button></div></div>;

  // Pricing Logic
  const currentBand = getPricingBand(selectedStart);

  // High-level check for energy support
  const energyFees = calculateEnergyBookingFees(
    vehicleSize,
    currentBand,
    listing.priceDay,
    listing.priceNight
  );

  const hasEnergyPricing = !energyFees.isIncomplete;

  let fees;
  if (hasEnergyPricing) {
    fees = energyFees;
  } else {
    // Final Legacy Fallback (using old hourly model)
    const legacyFees = calculateBookingFees(listing.pricePerHour, duration);
    fees = {
      baseCharge: legacyFees.baseFee,
      userServiceFee: legacyFees.serviceFee,
      userTotal: legacyFees.totalFee,
      isLegacy: true,
      reason: energyFees.error
    };
  }

  const isHostVerified = listing.hostProfile?.verificationStatus === 'approved';

  // Privacy Logic using centralized access control
  const exactLocationUnlocked = checkLocationUnlocked(user, id, userBookings);
  const userCanBook = canBook(user);
  const userCanInquire = canCreateInquiry(user, id);

  const handleAskHost = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!userCanInquire) {
      setInquiryError('Inquiry access is restricted for this account.');
      return;
    }
    setIsCreatingInquiry(true);
    setInquiryError('');
    try {
      const conv = await messagingService.createOrGetInquiry(id, user.id);
      navigate(`/app/messages?conversation=${conv.id}`);
    } catch (err) {
      console.error("Failed to create inquiry", err);
      setInquiryError(err.message || "Failed to start conversation.");
    } finally {
      setIsCreatingInquiry(false);
    }
  };

  const amenityIconsMap = {
    'wifi': <Wifi size={18} />,
    'cctv security': <Video size={18} />,
    'camera': <Video size={18} />,
    'covered parking': <ParkingCircle size={18} />,
    'parking': <ParkingCircle size={18} />,
    'drinking water': <Droplets size={18} />,
    'restroom access': <User size={18} />,
    'gated community': <Shield size={18} />,
    'near restaurants': <Utensils size={18} />,
    'garden seating': <Trees size={18} />,
    'overnight available': <Moon size={18} />,
    'dc fast charging': <Zap size={18} />,
    'near main boulevard': <Milestone size={18} />,
    'shopping area': <ShoppingBag size={18} />,
    'food court nearby': <Utensils size={18} />,
    'well-lit area': <Lightbulb size={18} />,
    'guarded parking': <ShieldCheck size={18} />,
    'security guard': <ShieldCheck size={18} />,
    'easy access from canal road': <Milestone size={18} />,
    'dedicated ev parking': <Zap size={18} />,
    'near sea view': <Waves size={18} />,
    'street parking': <ParkingCircle size={18} />,
    'quiet area': <Smartphone size={18} />,
    'tea/coffee offered': <Coffee size={18} />,
    '22kw fast ac': <Zap size={18} />,
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)' }}>
      {/* Image Gallery Header */}
      <div style={{ position: 'relative', height: 'clamp(260px, 45vw, 400px)', overflow: 'hidden' }}>
        <div
          role="img"
          aria-label={`Photo of ${listing.title}`}
          style={{
            width: '100%', height: '100%',
            // Brand gradient underneath, so a missing/broken photo still looks intentional.
            background: [
              listing.images[selectedImage] ? `url("${listing.images[selectedImage]}") center/cover no-repeat` : null,
              'radial-gradient(circle at 30% 40%, rgba(0,210,106,0.18), transparent 60%)',
              'linear-gradient(135deg, #111827, #0B0F19)',
            ].filter(Boolean).join(', '),
            transition: 'background-image 0.3s',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(11,15,25,0.95) 100%)' }} />

        {/* Back button */}
        <button type="button" onClick={() => {
          // Opened from a shared link: there's no in-app page to go back to.
          if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
          else navigate('/app/explore');
        }} style={{
          position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 10,
          padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(11,15,25,0.7)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)',
          fontSize: '0.9rem', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '0.5rem',
          transition: 'all 0.2s',
        }} onMouseOver={e => e.currentTarget.style.background = 'rgba(11,15,25,0.9)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(11,15,25,0.7)'}>
          <ArrowLeft size={16} /> Back to Explore
        </button>

        <button
          type="button"
          onClick={() => refreshListing({ force: true })}
          disabled={listingRefreshing}
          style={{
            position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10,
            padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(11,15,25,0.7)', color: '#fff', cursor: listingRefreshing ? 'wait' : 'pointer', backdropFilter: 'blur(8px)',
            fontSize: '0.85rem', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <RefreshCw size={15} className={listingRefreshing ? 'animate-spin' : ''} />
          {listingRefreshing ? 'Refreshing' : 'Refresh'}
        </button>

        {/* Overlay Chips */}
        <div style={{ position: 'absolute', top: '5rem', left: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', zIndex: 10 }}>
          {listing.chargerSpeed === '50kW' && (
            <span style={{ padding: '0.3rem 0.75rem', borderRadius: '20px', background: 'rgba(0,210,106,0.9)', color: '#000', fontSize: '0.8rem', fontWeight: 600, backdropFilter: 'blur(4px)' }}>⚡ DC Fast Charging</span>
          )}
          {listing.chargerSpeed === '22kW' && (
            <span style={{ padding: '0.3rem 0.75rem', borderRadius: '20px', background: 'rgba(0,240,255,0.9)', color: '#000', fontSize: '0.8rem', fontWeight: 600 }}>⚡ Fast Charging</span>
          )}
          {isHostVerified && (
            <span style={{ padding: '0.3rem 0.75rem', borderRadius: '20px', background: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)', fontSize: '0.8rem', fontWeight: 600, backdropFilter: 'blur(8px)', border: '1px solid rgba(0,210,106,0.3)' }}>✓ Verified Host</span>
          )}
        </div>

        {/* Thumbnail strip */}
        {listing.images.length > 1 && (
          <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', display: 'flex', gap: '8px', zIndex: 10 }}>
            {listing.images.slice(0, 4).map((img, i) => (
              <button type="button" key={i} onClick={() => setSelectedImage(i)} aria-label={`Show photo ${i + 1}`} style={{
                padding: 0,
                width: '60px', height: '45px', borderRadius: '6px', cursor: 'pointer',
                background: `url("${img}") center/cover no-repeat, #1f2937`,
                border: selectedImage === i ? '2px solid var(--brand-green)' : '2px solid rgba(255,255,255,0.3)',
                opacity: selectedImage === i ? 1 : 0.7, transition: 'all 0.2s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="section" style={{ paddingTop: '2rem' }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          {(listingRefreshing || listingLoadError || bookingsLoadError) && (
            <div style={{ marginBottom: '1rem', color: listingLoadError || bookingsLoadError ? '#fbbf24' : 'var(--brand-cyan)', fontSize: '0.85rem' }}>
              {listingLoadError || bookingsLoadError ? 'Could not refresh everything. Showing cached details where available.' : 'Refreshing charger details...'}
            </div>
          )}
          <div className="stack-on-tablet" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2.5rem' }}>

            {/* Left Column */}
            <div>
              <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{listing.title}</h1>
              <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                <span>{listing.area}, {listing.city}</span>
                <span>•</span>
                <span>{listing.chargerType}</span>
                {listing.rating > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#fbbf24' }}>★ {listing.rating} ({listing.reviewCount} reviews)</span>
                  </>
                )}
              </div>

              {/* Host Card */}
              {listing.host && (
                <div style={{
                  display: 'flex', gap: '1rem', padding: '1.25rem', marginBottom: '2rem',
                  background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-color)',
                  alignItems: 'center', flexWrap: 'wrap',
                }}>
                  <div style={{ flexShrink: 0 }}>
                    <Avatar
                      src={listing.host.avatar}
                      name={listing.host.name}
                      size="56px"
                      style={{
                        border: isHostVerified ? '3px solid var(--brand-green)' : '3px solid var(--border-color)',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{listing.host.name}</span>
                      {isHostVerified && (
                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: '10px', background: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)', fontSize: '0.7rem', fontWeight: 600 }}>✓ Verified</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>{listing.sessionsCompleted || 0} sessions</span>
                      <span>Joined {new Date(listing.host.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div>
                    <button
                      className="btn btn-secondary"
                      onClick={handleAskHost}
                      disabled={isCreatingInquiry || (user && !userCanInquire)}
                      style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <MessageSquare size={16} />
                      {isCreatingInquiry ? 'Loading...' : 'Ask Host'}
                    </button>
                    {inquiryError && (
                      <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.5rem', maxWidth: '180px' }}>
                        {inquiryError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>About this charger</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>{listing.description}</p>
              </div>

              {/* Amenities */}
              {listing.amenities?.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Amenities & Features</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))', gap: '0.75rem' }}>
                    {listing.amenities.map((amenity, i) => {
                      const icon = amenityIconsMap[amenity.toLowerCase()] || <CheckCircle size={18} style={{ opacity: 0.5 }} />;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                          <span style={{ color: 'var(--brand-green)', display: 'flex' }}>{icon}</span>
                          <span style={{ textTransform: 'capitalize' }}>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* House Rules */}
              {listing.houseRules?.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>House Rules</h3>
                  <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {listing.houseRules.map((rule, i) => (
                      <li key={i} style={{ fontSize: '0.9rem' }}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Map & Location */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>Location</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {exactLocationUnlocked ? <Unlock size={14} color="var(--brand-green)" /> : <Lock size={14} />}
                      {exactLocationUnlocked ? 'Precise location unlocked' : 'Broad area (Precise location protected)'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      className="btn"
                      disabled={!exactLocationUnlocked}
                      style={{
                        padding: '0.6rem 1.2rem',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        border: exactLocationUnlocked ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                        background: exactLocationUnlocked ? 'rgba(0, 210, 106, 0.08)' : 'rgba(255,255,255,0.03)',
                        color: exactLocationUnlocked ? 'var(--brand-green)' : 'var(--text-secondary)',
                        cursor: exactLocationUnlocked ? 'pointer' : 'not-allowed',
                        borderRadius: '10px',
                        fontWeight: 700,
                        transition: 'all 0.2s',
                        boxShadow: exactLocationUnlocked ? '0 0 15px rgba(0, 210, 106, 0.1)' : 'none'
                      }}
                      onMouseOver={e => {
                        if (exactLocationUnlocked) {
                          e.currentTarget.style.background = 'rgba(0, 210, 106, 0.15)';
                          e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 210, 106, 0.2)';
                        }
                      }}
                      onMouseOut={e => {
                        if (exactLocationUnlocked) {
                          e.currentTarget.style.background = 'rgba(0, 210, 106, 0.08)';
                          e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 210, 106, 0.1)';
                        }
                      }}
                      onClick={() => exactLocationUnlocked && window.open(`https://maps.google.com/?q=${listing.lat},${listing.lng}`)}
                    >
                      <MapPin size={16} color={exactLocationUnlocked ? 'var(--brand-green)' : 'currentColor'} />
                      Open in Google Maps
                      {exactLocationUnlocked && <ExternalLink size={14} />}
                    </button>
                    {!exactLocationUnlocked && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.6rem', fontWeight: 500, letterSpacing: '0.3px' }}>
                        Restricted to verified users with active bookings
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ height: '280px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', background: 'var(--bg-secondary)' }}>
                  {!exactLocationUnlocked && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, pointerEvents: 'none', background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      <div style={{
                        background: 'rgba(11,15,25,0.9)',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShieldCheck size={18} color="#fbbf24" strokeWidth={2.5} />
                          <span style={{ fontWeight: 600 }}>Privacy Protected</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Exact marker hidden for host safety</div>
                      </div>
                    </div>
                  )}
                  <MapContainer
                    center={exactLocationUnlocked ? [listing.lat, listing.lng] : getFuzzyCoordinates(listing.city, listing.lat, listing.lng)}
                    zoom={exactLocationUnlocked ? 16 : 13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={exactLocationUnlocked}
                  >
                    <BaseMapTiles />
                    {exactLocationUnlocked ? (
                      <Marker position={[listing.lat, listing.lng]} icon={smallIcon} />
                    ) : (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.15)', border: '2px dashed rgba(0, 240, 255, 0.4)', zIndex: 400 }} />
                    )}
                  </MapContainer>
                </div>

                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                  <MapPin size={24} color="var(--brand-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{listing.area}, {listing.city}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.3rem 0 0', lineHeight: 1.5 }}>
                      {exactLocationUnlocked ? listing.address : 'Exact address shared only after verification and booking confirmation.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reviews */}
              {listing.reviews?.length > 0 && (
                <div>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    Reviews ({listing.reviews.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {listing.reviews.map(review => (
                      <div key={review.id} style={{ display: 'flex', gap: '1rem' }}>
                        <Avatar
                          src={review.author?.avatar}
                          name={review.author?.name}
                          size="40px"
                        />
                        <div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 500 }}>{review.author?.name || 'User'}</span>
                            <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>{'★'.repeat(review.rating)}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>{review.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — Booking Card */}
            <div className="col-lg-5" id="reserve">
              <div style={{ position: 'sticky', top: '100px' }}>
                <div className="glass-card reserve-card">
                  {/* Header: title, availability, price */}
                  <div className="reserve-header">
                    <div className="reserve-title-row">
                      <h3 className="reserve-title">Reserve a session</h3>
                      {availabilityChip && (
                        <span className={`reserve-chip reserve-chip--${availabilityChip.tone}`}>{availabilityChip.label}</span>
                      )}
                    </div>
                    {hasEnergyPricing ? (
                      <div className="reserve-price">
                        <span className="reserve-price-value">{formatPKR(fees.rateUsed)}</span>
                        <span className="reserve-price-unit">/ kWh</span>
                        <span className={`reserve-band ${currentBand === PRICING_BAND.DAY ? 'is-day' : 'is-night'}`}>
                          {currentBand === PRICING_BAND.DAY ? <Zap size={11} /> : <Moon size={11} />}
                          {currentBand === PRICING_BAND.DAY ? 'Day rate' : 'Night rate'}
                        </span>
                      </div>
                    ) : (
                      <div className="reserve-price">
                        <span className="reserve-price-value">{formatPKR(listing.pricePerHour)}</span>
                        <span className="reserve-price-unit">/ hr</span>
                      </div>
                    )}
                  </div>

                  <div className="reserve-fields">
                    {/* Date */}
                    <div className="reserve-field">
                      <label className="reserve-label">Date</label>
                      <DatePicker
                        selected={selectedDate instanceof Date ? selectedDate : new Date(selectedDate)}
                        onChange={(date) => setSelectedDate(date)}
                        minDate={new Date()}
                        dateFormat="EEEE, MMMM d, yyyy"
                        customInput={
                          <button type="button" className="reserve-control">
                            <Calendar size={18} color="var(--brand-green)" />
                            <span className="reserve-control-value">
                              {(selectedDate instanceof Date ? selectedDate : new Date(selectedDate)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <ChevronDown size={16} className="reserve-chevron" />
                          </button>
                        }
                      />
                    </div>

                    {/* Arrival + Duration */}
                    <div className="reserve-row">
                      <div className="reserve-field custom-dropdown-container">
                        <label className="reserve-label">Arrival</label>
                        <button
                          type="button"
                          className={`reserve-control ${isStartOpen ? 'is-open' : ''}`}
                          onClick={() => { setIsStartOpen(!isStartOpen); setIsDurationOpen(false); }}
                          aria-expanded={isStartOpen}
                        >
                          <span className={`reserve-control-value ${selectedStart ? '' : 'is-placeholder'}`}>
                            {selectedStart ? formatTime12h(selectedStart) : 'Select time'}
                          </span>
                          <ChevronDown size={16} className="reserve-chevron" />
                        </button>

                        {isStartOpen && (
                          <div className="reserve-popover reserve-popover--wide" role="listbox" aria-label="Arrival time">
                            {slotsLoading ? (
                              <div className="reserve-popover-empty">Loading times…</div>
                            ) : slots.length === 0 ? (
                              <div className="reserve-popover-empty">No times available on this date.</div>
                            ) : (
                              <div className="reserve-chip-grid">
                                {slots.map(slot => (
                                  <button
                                    type="button"
                                    key={slot.startTime}
                                    role="option"
                                    aria-selected={selectedStart === slot.startTime}
                                    disabled={slot.isBooked}
                                    title={slot.isBooked ? 'Already booked' : undefined}
                                    className={`reserve-option ${selectedStart === slot.startTime ? 'is-selected' : ''}`}
                                    onClick={() => { setSelectedStart(slot.startTime); setIsStartOpen(false); }}
                                  >
                                    {formatTime12h(slot.startTime)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="reserve-field custom-dropdown-container">
                        <label className="reserve-label">Duration</label>
                        <button
                          type="button"
                          className={`reserve-control ${isDurationOpen ? 'is-open' : ''}`}
                          onClick={() => { setIsDurationOpen(!isDurationOpen); setIsStartOpen(false); }}
                          aria-expanded={isDurationOpen}
                        >
                          <span className="reserve-control-value">{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                          <ChevronDown size={16} className="reserve-chevron" />
                        </button>

                        {isDurationOpen && (
                          <div className="reserve-popover reserve-popover--right" role="listbox" aria-label="Duration">
                            <div className="reserve-chip-grid reserve-chip-grid--duration">
                              {[1, 2, 3, 4, 6, 8, 12].map(h => (
                                <button
                                  type="button"
                                  key={h}
                                  role="option"
                                  aria-selected={duration === h}
                                  className={`reserve-option ${duration === h ? 'is-selected' : ''}`}
                                  onClick={() => { setDuration(h); setIsDurationOpen(false); }}
                                >
                                  {h}h
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vehicle: three options, so a segmented control instead of a dropdown */}
                    {hasEnergyPricing && (
                      <div className="reserve-field">
                        <span className="reserve-label" id="vehicle-label">Vehicle</span>
                        <div className="reserve-segmented" role="radiogroup" aria-labelledby="vehicle-label">
                          {Object.keys(VEHICLE_SIZES).map(size => (
                            <button
                              type="button"
                              key={size}
                              role="radio"
                              aria-checked={vehicleSize === size}
                              className={`reserve-segment ${vehicleSize === size ? 'is-selected' : ''}`}
                              onClick={() => setVehicleSize(size)}
                            >
                              <span className="reserve-segment-name">{VEHICLE_LABELS[size]?.name || size}</span>
                              <span className="reserve-segment-meta">{ENERGY_BY_SIZE[size]} kWh</span>
                            </button>
                          ))}
                        </div>
                        <div className="reserve-hint">{VEHICLE_LABELS[vehicleSize]?.hint}</div>
                      </div>
                    )}
                  </div>

                  {/* Microcopy Help Text */}
                  {hasEnergyPricing && currentBand === PRICING_BAND.NIGHT && (
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(251, 191, 36, 0.05)', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                      <Moon size={14} color="#fbbf24" />
                      <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>Night bookings are charged at a higher rate.</span>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="reserve-summary">
                    {hasEnergyPricing ? (
                      <>
                        <div className="reserve-summary-row">
                          <span>{fees.energyKwh} kWh × {formatPKR(fees.rateUsed)}</span>
                          <span>{formatPKR(fees.baseCharge)}</span>
                        </div>
                        <div className="reserve-summary-row">
                          <span>Service fee</span>
                          <span>{formatPKR(fees.userServiceFee)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="reserve-summary-row">
                          <span>Base ({duration} hr window)</span>
                          <span>{formatPKR(fees.baseCharge || fees.baseFee)}</span>
                        </div>
                        <div className="reserve-summary-row">
                          <span>Service fee</span>
                          <span>{formatPKR(fees.userServiceFee || fees.serviceFee)}</span>
                        </div>
                      </>
                    )}

                    <div className="reserve-summary-total">
                      <span>Total</span>
                      <span>{formatPKR(fees.userTotal || fees.totalFee)}</span>
                    </div>
                  </div>

                  {!userCanBook ? (
                    <>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '1.05rem', padding: '0.8rem', border: '1px solid var(--brand-cyan)', color: 'var(--brand-cyan)' }}
                        onClick={() => navigate(user ? '/app/verification' : '/login')}
                      >
                        {!user ? 'Login to Book' : user?.verificationStatus === 'under_review' ? 'Verification Pending...' : 'Complete Verification to Book'}
                      </button>
                      <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.8rem', color: '#fbbf24' }}>
                        For host safety, booking is available only to verified EV users.
                      </div>
                    </>
                  ) : slotsLoading ? (
                    <div style={{ padding: '1.5rem', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: '12px', textAlign: 'center', color: 'var(--brand-cyan)', fontWeight: 600 }}>
                      Loading availability...
                    </div>
                  ) : slots.length === 0 ? (
                    <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                      <p style={{ color: '#ef4444', fontWeight: 600, margin: 0 }}>
                        {noSlotsReason === 'past' ? "Operating hours have ended for today." : "No availability set for this date."}
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                        {noSlotsReason === 'past' ? "Please choose another date for your session." : "Try choosing another date or contact the host."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '1.05rem', padding: '0.8rem' }}
                        onClick={() => {
                          const dStr = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
                          navigate(`/app/book/${id}?date=${dStr}&start=${selectedStart}&duration=${duration}&vehicleSize=${vehicleSize}`);
                        }}
                        disabled={!selectedStart || slots.filter(s => !s.isBooked).length === 0}
                      >
                        {!selectedStart ? 'Select Arrival Time' : 'Reserve Slot'}
                      </button>
                      <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        You won't be charged yet.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phones: the booking card sits below the details, so keep a
          price + Reserve shortcut pinned to the bottom of the screen. */}
      <div className="mobile-reserve-bar">
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--brand-green)' }}>
            {formatPKR(fees.rateUsed)} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ kWh</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Est. total {formatPKR(fees.userTotal || fees.totalFee)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.7rem 1.4rem' }}
          onClick={() => document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Reserve
        </button>
      </div>
    </div>
  );
};

export default ChargerDetail;
