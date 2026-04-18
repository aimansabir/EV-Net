import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './MarketplacePreview.css';

const customIcon = new L.DivIcon({ className: 'custom-map-marker', html: `<div class="marker-pin"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const activeIcon = new L.DivIcon({ className: 'custom-map-marker active', html: `<div class="marker-pin active-pin"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

const mockListings = [
  { id: 1, title: 'Gulberg Home Charger', desc: '11kW • Available 2pm - 8pm', price: 'Rs. 800 / hr', lat: 31.5300, lng: 74.3400 },
  { id: 2, title: 'DHA Phase 6 Villa', desc: '22kW Fast • Available Now', price: 'Rs. 1200 / hr', lat: 31.5120, lng: 74.3600 },
  { id: 3, title: 'Model Town Station', desc: '7kW AC • Available Now', price: 'Rs. 600 / hr', lat: 31.4700, lng: 74.3200 }
];

const MapFlyToMarker = ({ activeListing }) => {
  const map = useMap();
  React.useEffect(() => {
    if (activeListing) {
      map.flyTo([activeListing.lat, activeListing.lng], 14, { duration: 1 });
    }
  }, [activeListing, map]);
  return null;
};

const MarketplacePreview = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState(mockListings[1]);

  return (
    <section className="section preview-section">
      <div className="container">
        <div className="text-center mb-5">
          <h2 className="section-title">Experience the Platform</h2>
          <p style={{color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto'}}>A fully web-based marketplace accessible from any device. No downloads required.</p>
        </div>

        <div className="preview-window">
          <div className="pw-header">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
            <div className="pw-search">Search 'Karachi, Lahore route chargers'...</div>
          </div>
          <div className="pw-body">
            <div className="pw-sidebar">
              <div className="pw-filter-title">Filters</div>
              <div className="pw-filter-item">Fast Charging (22kW+)</div>
              <div className="pw-filter-item">Available Now</div>
              <div className="pw-filter-item">Top Rated Hosts</div>
              
              <div className="mt-3" style={{ flex: 1, overflowY: 'auto' }}>
                {mockListings.map(listing => (
                  <div 
                    key={listing.id} 
                    className={`pw-card ${active.id === listing.id ? 'active' : ''}`}
                    onClick={() => setActive(listing)}
                  >
                    <h4>{listing.title}</h4>
                    <p>{listing.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="pw-price">{listing.price}</div>
                      {active.id === listing.id && (
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => navigate(`/app/book/${listing.id}`)}>Book</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pw-map" style={{ position: 'relative' }}>
              <MapContainer 
                 center={[31.5204, 74.3587]} 
                 zoom={12} 
                 scrollWheelZoom={false}
                 style={{ height: '100%', width: '100%', zIndex: 0 }}
                 zoomControl={false}
               >
                 <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                 />
                 <MapFlyToMarker activeListing={active} />
                 {mockListings.map(m => (
                   <Marker 
                     key={m.id} 
                     position={[m.lat, m.lng]} 
                     icon={active.id === m.id ? activeIcon : customIcon}
                     eventHandlers={{ click: () => setActive(m) }}
                   />
                 ))}
               </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketplacePreview;
