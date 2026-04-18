import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './HeroSection.css';

const customIcon = new L.DivIcon({ className: 'custom-map-marker', html: `<div class="marker-pin"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const activeIcon = new L.DivIcon({ className: 'custom-map-marker active', html: `<div class="marker-pin active-pin"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

const mockMarkers = [
  { id: 1, lat: 31.5100, lng: 74.3600, title: 'DHA Phase 6 Villa', desc: '22kW Fast • Available Now' },
  { id: 2, lat: 31.5300, lng: 74.3500, title: 'Gulberg Home Charger', desc: '11kW • Available 2pm - 8pm' },
  { id: 3, lat: 31.5250, lng: 74.3700, title: 'Model Town Station', desc: '7kW AC • Available Now' }
];

const HeroSection = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, isInitialized } = useAuthStore();
  const [activeMarker, setActiveMarker] = useState(mockMarkers[0]);

  return (
    <section className="hero-section" id="hero">
      <div className="container hero-container">

        <div className="hero-content animate-fade-in">
          <div className="badge">Pakistan’s First Community-Powered EV Charging</div>
          <h1 className="hero-title">
            Unlocking Pakistan’s Hidden <br />
            <span className="text-gradient">EV Charging Network</span>
          </h1>
          <p className="hero-subtitle">
            EV-Net connects households with idle home chargers to EV users who need accessible, reliable charging options across Pakistan.
          </p>
          <div className="hero-actions" style={{ minHeight: '48px' }}>
            {!isInitialized ? null : isAuthenticated ? (
              <>
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate(role === 'host' ? '/host/dashboard' : role === 'admin' ? '/admin' : '/app/explore')}
                >
                  {role === 'host' ? 'Host Dashboard' : role === 'admin' ? 'Admin Dashboard' : 'Explore Chargers'}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate(role === 'host' ? '/host/listings' : role === 'admin' ? '/admin/listings' : '/app/bookings')}
                >
                  {role === 'host' ? 'Manage Listings' : role === 'admin' ? 'Manage All Listings' : 'My Bookings'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => navigate('/app/explore')}>Explore Charging Network</button>
                <button className="btn btn-secondary" onClick={() => navigate('/signup/host')}>Become a Charging Host</button>
              </>
            )}
          </div>
          <p className="hero-link"><a href="#how-it-works">See How It Works &rarr;</a></p>
        </div>

        <div className="hero-visual animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="browser-mockup">
            <div className="browser-header">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
              <div className="url-bar">app.EV-Net.pk/explore</div>
            </div>
            <div className="browser-body">
              <MapContainer
                center={[31.5204, 74.3587]}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap'
                />

                {mockMarkers.map(m => (
                  <Marker
                    key={m.id}
                    position={[m.lat, m.lng]}
                    icon={activeMarker.id === m.id ? activeIcon : customIcon}
                    eventHandlers={{ click: () => setActiveMarker(m) }}
                  />
                ))}
              </MapContainer>

              <div className="mockup-ui-overlay">
                <div className="filter-chip">⚡ Fast Chargers Only</div>
              </div>

              <div className="mockup-card" style={{ zIndex: 1000, position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(17,24,39,0.95)', border: '1px solid var(--border-color)', padding: '1.2rem', borderRadius: '8px', width: '240px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>{activeMarker.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{activeMarker.desc}</div>
                <button style={{ background: 'var(--brand-green)', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 600, width: '100%', cursor: 'pointer' }} onClick={() => navigate('/app/book/1')}>Book Slot</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
