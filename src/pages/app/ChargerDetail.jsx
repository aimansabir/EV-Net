import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { listingService, availabilityService, bookingService } from '../../data/api';
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
  Lightbulb, Waves, Coffee, Milestone, Smartphone, CheckCircle
} from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import useAuthStore from '../../store/authStore';
import { canBook, exactLocationUnlocked as checkLocationUnlocked, canCreateInquiry } from '../../utils/accessControl';
import { messagingService } from '../../data/api';
import { getFuzzyCoordinates } from '../../data/cityCoordinates';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/calendar.css';
import 'leaflet/dist/leaflet.css';

const smallIcon = new L.DivIcon({ className: 'custom-map-marker', html: `<div class="marker-pin"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

const formatTime12h = (time24) => {
  if (!time24) return '';
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour; // handle 00:00 and 12:00
  return `${hour}:${minuteStr} ${ampm}`;
};

const ChargerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [selectedStart, setSelectedStart] = useState('');
  const duration = 2;
  const [vehicleSize, setVehicleSize] = useState(VEHICLE_SIZES.SMALL);
  const [userBookings, setUserBookings] = useState([]);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isVehicleOpen, setIsVehicleOpen] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    const load = async () => {
      const data = await listingService.getById(id);
      setListing(data);

      if (user) {
        try {
          const bookings = await bookingService.getByUser(user.id);
          setUserBookings(bookings || []);
        } catch (err) {
          console.error("Failed to fetch bookings:", err);
        }
      }

      setLoading(false);
      if (data) {
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

        setSlots(validSlots);
        
        // Pre-select first available future slot
        const firstAvail = validSlots.find(s => !s.isBooked);
        if (firstAvail) {
          setSelectedStart(firstAvail.startTime);
        } else {
          setSelectedStart('');
        }
      }
    };
    load();
  }, [id, selectedDate, user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-dropdown-container')) {
        setIsStartOpen(false);
        setIsVehicleOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if (!listing) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div>Listing not found</div></div>;

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
      reason: energyFees.error // e.g. MISSING_RATE
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
      <div style={{ position: 'relative', height: '400px', overflow: 'hidden' }}>
        <div style={{
          width: '100%', height: '100%',
          background: `url(${listing.images[selectedImage]}) center/cover`,
          transition: 'background-image 0.3s',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(11,15,25,0.95) 100%)' }} />

        {/* Back button */}
        <button onClick={() => navigate(-1)} style={{
          position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 10,
          padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(11,15,25,0.7)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)',
          fontSize: '0.9rem', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '0.5rem',
          transition: 'all 0.2s',
        }} onMouseOver={e => e.currentTarget.style.background = 'rgba(11,15,25,0.9)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(11,15,25,0.7)'}>
          <ArrowLeft size={16} /> Back to Explore
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
              <div key={i} onClick={() => setSelectedImage(i)} style={{
                width: '60px', height: '45px', borderRadius: '6px', cursor: 'pointer',
                background: `url(${img}) center/cover`,
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2.5rem' }}>

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
                  alignItems: 'center',
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
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{listing.host.name}</span>
                      {isHostVerified && (
                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: '10px', background: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)', fontSize: '0.7rem', fontWeight: 600 }}>✓ Verified</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>{listing.sessionsCompleted} sessions</span>
                      <span>~5 min response</span>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
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
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
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
            <div className="col-lg-5">
              <div style={{ position: 'sticky', top: '100px' }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: '620px', marginLeft: 'auto', padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'visible' }}>
                  {/* Main Header / Pricing Summary */}
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>Reserve Session</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {hasEnergyPricing ? (
                            <div className="modern-pricing-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-green)' }}>{formatPKR(fees.rateUsed)} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ kWh</span></span>
                              <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
                              <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: currentBand === PRICING_BAND.DAY ? 'var(--brand-cyan)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {currentBand === PRICING_BAND.DAY ? <Zap size={10} /> : <Moon size={10} />}
                                {currentBand}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-green)' }}>{formatPKR(listing.pricePerHour)} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ hr</span></span>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Legacy Hourly Rate</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'rgba(0,210,106,0.1)',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(0,210,106,0.2)',
                        height: 'fit-content'
                      }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--brand-green)', textTransform: 'uppercase' }}>Available Today</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Date — Full Width */}
                    <div style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontWeight: 800 }}>Choose Date</label>
                      <DatePicker
                        selected={selectedDate instanceof Date ? selectedDate : new Date(selectedDate)}
                        onChange={(date) => setSelectedDate(date)}
                        minDate={new Date()}
                        dateFormat="EEEE, MMMM d, yyyy"
                        customInput={
                          <button className="custom-date-input" style={{ width: '100%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: '12px', color: '#fff', fontSize: '1rem', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                            <div style={{ background: 'rgba(0,210,106,0.1)', padding: '8px', borderRadius: '8px' }}><Calendar size={20} color="var(--brand-green)" /></div>
                            <span style={{ fontWeight: 600 }}>{selectedDate instanceof Date ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </button>
                        }
                      />
                    </div>

                    {/* Row 2 — Time and (Conditional) Vehicle */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {/* Start Time Dropdown */}
                      <div className="custom-dropdown-container" style={{ flex: 1, position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>Arrival</label>
                        <button
                          onClick={() => setIsStartOpen(!isStartOpen)}
                          type="button"
                          style={{
                            width: '100%',
                            height: '64px',
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isStartOpen ? 'var(--brand-green)' : 'var(--border-color)'}`,
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isStartOpen ? '0 8px 16px rgba(0,0,0,0.3)' : 'none',
                            position: 'relative',
                            zIndex: 2
                          }}
                        >
                          <Clock size={18} color="var(--brand-green)" />
                          <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                            {selectedStart ? formatTime12h(selectedStart) : 'Select'}
                          </span>
                          <ChevronDown size={16} style={{ opacity: 0.3, marginLeft: 'auto', transform: isStartOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {isStartOpen && (
                          <div style={{
                            position: 'absolute', 
                            top: '100%', 
                            left: 0, 
                            width: '100%', 
                            marginTop: '10px',
                            background: '#1a1a1a', 
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '12px', 
                            overflow: 'hidden', 
                            zIndex: 9999,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.9)', 
                            backdropFilter: 'blur(40px)',
                            minHeight: '40px'
                          }}>
                            <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '6px' }}>
                              {slots.length === 0 ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                  No hours available
                                </div>
                              ) : (
                                slots.map(s => (
                                  <button
                                    key={s.startTime}
                                    disabled={s.isBooked}
                                    onClick={() => { 
                                      if (!s.isBooked) {
                                        setSelectedStart(s.startTime); 
                                        setIsStartOpen(false); 
                                      }
                                    }}
                                    style={{
                                      width: '100%', 
                                      padding: '0.8rem 1rem', 
                                      background: 'transparent',
                                      border: 'none', 
                                      color: s.isBooked ? '#4b5563' : (selectedStart === s.startTime ? 'var(--brand-green)' : '#fff'),
                                      textAlign: 'left', 
                                      cursor: s.isBooked ? 'not-allowed' : 'pointer', 
                                      fontSize: '0.95rem',
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      borderRadius: '8px', 
                                      transition: 'background 0.2s',
                                      marginBottom: '2px',
                                      opacity: s.isBooked ? 0.6 : 1
                                    }}
                                    onMouseOver={e => !s.isBooked && (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                    onMouseOut={e => !s.isBooked && (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {formatTime12h(s.startTime)}
                                      {s.isBooked && <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>Booked</span>}
                                    </div>
                                    {selectedStart === s.startTime && <CheckCircle size={14} color="var(--brand-green)" />}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Vehicle Size Selection — Responsive to Energy Pricing */}
                      {hasEnergyPricing && (
                        <div className="custom-dropdown-container" style={{ flex: 1.2, position: 'relative' }}>
                          <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>Vehicle</label>
                          <button
                            onClick={() => setIsVehicleOpen(!isVehicleOpen)}
                            style={{
                              width: '100%',
                              height: '84px',
                              background: 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isVehicleOpen ? 'var(--brand-green)' : 'var(--border-color)'}`,
                              padding: '0.75rem',
                              borderRadius: '12px',
                              color: '#fff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: isVehicleOpen ? '0 8px 16px rgba(0,0,0,0.3)' : 'none'
                            }}
                          >
                            <Zap size={16} color="var(--brand-green)" />
                            <span style={{ fontSize: '1rem', fontWeight: 600 }}>{vehicleSize === 'MEDIUM' ? 'Medium' : vehicleSize.charAt(0) + vehicleSize.slice(1).toLowerCase()}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--brand-cyan)', fontWeight: 600 }}>{ENERGY_BY_SIZE[vehicleSize]} kWh</div>
                          </button>

                          {isVehicleOpen && (
                            <div style={{
                              position: 'absolute', top: '100%', right: 0, width: '310px', marginTop: '10px',
                              background: 'rgba(18, 18, 18, 1)', border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '16px', overflow: 'hidden', zIndex: 1000,
                              boxShadow: '0 30px 80px rgba(0,0,0,0.95)', backdropFilter: 'blur(40px)'
                            }}>
                              <div style={{ padding: '8px' }}>
                                {Object.keys(VEHICLE_SIZES).map(size => (
                                  <button
                                    key={size}
                                    onClick={() => { setVehicleSize(size); setIsVehicleOpen(false); }}
                                    style={{
                                      width: '100%', padding: '1.25rem 1.5rem', background: 'transparent',
                                      border: 'none', color: vehicleSize === size ? 'var(--brand-green)' : '#fff',
                                      textAlign: 'left', cursor: 'pointer', fontSize: '0.95rem',
                                      borderRadius: '12px', transition: 'all 0.2s',
                                      display: 'flex', flexDirection: 'column', gap: '4px',
                                      marginBottom: '6px'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <span style={{ fontWeight: 700, fontSize: '1.05rem', whiteSpace: 'nowrap', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      {size === 'SMALL' ? 'Small Car (40 kWh)' : size === 'MEDIUM' ? 'Medium-size (60 kWh)' : 'Large SUV (80 kWh)'}
                                      {vehicleSize === size && <CheckCircle size={14} color="var(--brand-green)" />}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', opacity: 0.8 }}>
                                      {size === 'SMALL' ? 'Ideal for Hatchbacks & small city EVs' : size === 'MEDIUM' ? 'Ideal for Sedans, Crossovers & compact SUVs' : 'Ideal for full-size SUVs, Trucks & Luxury EVs'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Microcopy Help Text */}
                  {hasEnergyPricing && currentBand === PRICING_BAND.NIGHT && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(251, 191, 36, 0.05)', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                      <Moon size={14} color="#fbbf24" />
                      <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>Night bookings are charged at a higher rate.</span>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    {hasEnergyPricing ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Rate ({currentBand})</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(fees.rateUsed)}/kWh</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Energy Estimate</span>
                          <span style={{ fontWeight: 600 }}>{fees.energyKwh} kWh</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Service Fee</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(fees.userServiceFee)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Base ({duration}hr window)</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(fees.baseCharge || fees.baseFee)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Service fee</span>
                          <span style={{ fontWeight: 600 }}>{formatPKR(fees.userServiceFee || fees.serviceFee)}</span>
                        </div>
                      </>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '1.25rem',
                      paddingTop: '1.25rem',
                      borderTop: '1px dashed rgba(255,255,255,0.1)',
                      width: '100%'
                    }}>
                      <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 700 }}>Total Payable</span>
                      <span style={{ color: 'var(--brand-green)', fontSize: '1.15rem', fontWeight: 800, marginLeft: 'auto' }}>{formatPKR(fees.userTotal || fees.totalFee)}</span>
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
                  ) : slots.length === 0 ? (
                    <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                      <p style={{ color: '#ef4444', fontWeight: 600, margin: 0 }}>No available slots for this date.</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.4rem' }}>Try choosing another date or earlier time.</p>
                    </div>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '1.05rem', padding: '0.8rem' }}
                        onClick={() => {
                          const dStr = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
                          // If energy pricing is active, pass vehicleSize. If legacy, it's not needed for price but good for context.
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
    </div>
  );
};

export default ChargerDetail;
