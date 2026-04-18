import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { listingService, availabilityService, bookingService } from '../../data/api';
import { calculateBookingFees, formatPKR } from '../../data/feeConfig';
import DatePicker from 'react-datepicker';
import { Calendar, MapPin, ArrowLeft, Lock, Unlock, ExternalLink, ShieldCheck, ChevronDown, Clock, Timer, MessageSquare } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { canBook, exactLocationUnlocked as checkLocationUnlocked, canCreateInquiry } from '../../utils/accessControl';
import { messagingService } from '../../data/api';
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
  const [duration, setDuration] = useState(2);
  const [userBookings, setUserBookings] = useState([]);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
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
        setSlots(daySlots);
        const firstAvail = daySlots.find(s => !s.isBooked);
        if (firstAvail) setSelectedStart(firstAvail.startTime);
      }
    };
    load();
  }, [id, selectedDate, user]);

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

  if (loading) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'var(--text-secondary)' }}>Loading...</div></div>;
  if (!listing) return <div className="section" style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div>Listing not found</div></div>;

  const fees = calculateBookingFees(listing.pricePerHour, duration);
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
      alert("Inquiry access restricted.");
      return;
    }
    setIsCreatingInquiry(true);
    try {
      const conv = await messagingService.createOrGetInquiry(id, user.id);
      navigate(`/app/messages?conversation=${conv.id}`);
    } catch (err) {
      console.error("Failed to create inquiry", err);
      alert(err.message || "Failed to start conversation.");
    } finally {
      setIsCreatingInquiry(false);
    }
  };

  const amenityIcons = {
    'WiFi Available': '📶', 'CCTV Security': '📹', 'Covered Parking': '🅿️', 'Drinking Water': '💧',
    'Restroom Access': '🚻', 'Gated Community': '🔒', 'Near Restaurants': '🍽️', 'Garden Seating': '🌿',
    'Overnight Available': '🌙', 'DC Fast Charging': '⚡', 'Near Main Boulevard': '🛣️',
    'Shopping Area': '🛍️', 'Food Court Nearby': '🍔', 'Well-Lit Area': '💡', 'Guarded Parking': '💂',
    'Security Guard': '💂', 'Easy Access from Canal Road': '🛣️', 'Dedicated EV Parking': '🔌',
    'Near Sea View': '🌊', 'Street Parking': '🅿️', 'Quiet Area': '🤫', 'Tea/Coffee Offered': '☕',
    '22kW Fast AC': '⚡',
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
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                    background: listing.host.avatar ? `url(${listing.host.avatar}) center/cover` : '#333',
                    border: isHostVerified ? '3px solid var(--brand-green)' : '3px solid var(--border-color)',
                  }} />
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
                    {listing.amenities.map((amenity, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <span>{amenityIcons[amenity] || '✓'}</span>
                        <span>{amenity}</span>
                      </div>
                    ))}
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
                    center={exactLocationUnlocked ? [listing.lat, listing.lng] : [listing.lat + 0.003, listing.lng - 0.003]} 
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
                
                <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <MapPin size={18} color={exactLocationUnlocked ? 'var(--brand-green)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                      {exactLocationUnlocked ? listing.address : `${listing.area}, ${listing.city}`}
                    </span>
                  </div>
                  {!exactLocationUnlocked && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={12} /> Exact address shared only after verification and booking confirmation.
                    </p>
                  )}
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
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                          background: review.author?.avatar ? `url(${review.author.avatar}) center/cover` : '#333',
                        }} />
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
            <div>
              <div className="glass-card" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--brand-green)' }}>
                  {formatPKR(listing.pricePerHour)} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ hour</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ border: '1px solid var(--border-color)', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Date</label>
                    <DatePicker 
                      selected={selectedDate instanceof Date ? selectedDate : new Date(selectedDate)} 
                      onChange={(date) => setSelectedDate(date)} 
                      minDate={new Date()}
                      dateFormat="MMM d, yyyy"
                      customInput={
                        <button className="custom-date-input">
                          <Calendar size={18} color="var(--brand-green)" />
                          {selectedDate instanceof Date ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </button>
                      }
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Start Time Dropdown */}
                    <div className="custom-dropdown-container" style={{ flex: 1, position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Time</label>
                      <button 
                        onClick={() => setIsStartOpen(!isStartOpen)}
                        style={{ 
                          width: '100%', 
                          background: 'rgba(255,255,255,0.03)', 
                          border: `1px solid ${isStartOpen ? 'var(--brand-green)' : 'var(--border-color)'}`, 
                          padding: '0.75rem', 
                          borderRadius: '10px',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} color="var(--brand-green)" />
                          <span style={{ fontSize: '0.9rem' }}>{selectedStart ? formatTime12h(selectedStart) : 'Select'}</span>
                        </div>
                        <ChevronDown size={14} style={{ transform: isStartOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {isStartOpen && (
                        <div style={{ 
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '5px',
                          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                          borderRadius: '10px', overflow: 'hidden', zIndex: 100,
                          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)'
                        }}>
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {slots.filter(s => !s.isBooked).map(s => (
                              <button 
                                key={s.startTime}
                                onClick={() => { setSelectedStart(s.startTime); setIsStartOpen(false); }}
                                style={{ 
                                  width: '100%', padding: '0.75rem 1rem', background: 'transparent',
                                  border: 'none', color: selectedStart === s.startTime ? 'var(--brand-green)' : '#fff',
                                  textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {formatTime12h(s.startTime)}
                                {selectedStart === s.startTime && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--brand-green)' }} />}
                              </button>
                            ))}
                            {slots.filter(s => !s.isBooked).length === 0 && (
                              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No slots avail</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Duration Dropdown */}
                    <div className="custom-dropdown-container" style={{ flex: 1, position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</label>
                      <button 
                        onClick={() => setIsDurationOpen(!isDurationOpen)}
                        style={{ 
                          width: '100%', 
                          background: 'rgba(255,255,255,0.03)', 
                          border: `1px solid ${isDurationOpen ? 'var(--brand-green)' : 'var(--border-color)'}`, 
                          padding: '0.75rem', 
                          borderRadius: '10px',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Timer size={14} color="var(--brand-green)" />
                          <span style={{ fontSize: '0.9rem' }}>{duration} hour{duration > 1 ? 's' : ''}</span>
                        </div>
                        <ChevronDown size={14} style={{ transform: isDurationOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {isDurationOpen && (
                        <div style={{ 
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '5px',
                          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                          borderRadius: '10px', overflow: 'hidden', zIndex: 100,
                          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)'
                        }}>
                          {[1, 2, 3, 4].map(h => (
                            <button 
                              key={h}
                              onClick={() => { setDuration(h); setIsDurationOpen(false); }}
                              style={{ 
                                width: '100%', padding: '0.75rem 1rem', background: 'transparent',
                                border: 'none', color: duration === h ? 'var(--brand-green)' : '#fff',
                                textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                              }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {h} hour{h > 1 ? 's' : ''}
                              {duration === h && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--brand-green)' }} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fee Breakdown */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base fee ({duration}hr × {formatPKR(listing.pricePerHour)})</span>
                    <span>{formatPKR(fees.baseFee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Service fee 
                      <span style={{ fontSize: '0.65rem', background: 'rgba(0,210,106,0.2)', color: 'var(--brand-green)', padding: '1px 5px', borderRadius: '3px' }}>10%</span>
                    </span>
                    <span>{formatPKR(fees.serviceFee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--brand-green)' }}>{formatPKR(fees.totalFee)}</span>
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
                ) : (
                  <>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', fontSize: '1.05rem', padding: '0.8rem' }}
                      onClick={() => {
                        const dStr = selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate;
                        navigate(`/app/book/${id}?date=${dStr}&start=${selectedStart}&duration=${duration}`);
                      }}
                      disabled={!selectedStart || slots.filter(s => !s.isBooked).length === 0}
                    >
                      Reserve Slot
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
  );
};

export default ChargerDetail;
