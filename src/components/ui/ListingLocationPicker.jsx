import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X } from 'lucide-react';
import axios from 'axios';

// Fix for default Leaflet icon not showing in Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

/**
 * RecenterMap Component
 * Helper to update map view when selection changes
 */
const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16);
  }, [position, map]);
  return null;
};

/**
 * DraggableMarker Component
 */
const LocationMarker = ({ position, onDragEnd }) => {
  const markerRef = useRef(null);
  const eventHandlers = useCallback(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        onDragEnd(marker.getLatLng());
      }
    },
  }), [onDragEnd]);

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers()}
      position={position}
      ref={markerRef}
    />
  );
};

const ListingLocationPicker = ({ 
  initialValue = '', 
  initialLat = 24.8607, // default Karachi
  initialLng = 67.0011,
  onLocationChange 
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const lastRequest = useRef(0);

  // Debounce logic for Nominatim
  useEffect(() => {
    if (!query || query.length < 3 || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = Date.now();
      lastRequest.current = requestId;
      
      try {
        setLoading(true);
        // Specifically look for Pakistan addresses for better quality
        const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
          params: {
            q: query,
            format: 'json',
            addressdetails: 1,
            limit: 5,
            countrycodes: 'pk'
          },
          headers: {
             'Accept-Language': 'en'
          }
        });

        // Prevention for stale results
        if (lastRequest.current === requestId) {
          setSuggestions(res.data);
        }
      } catch (err) {
        console.error("Geocoding error:", err);
      } finally {
        if (lastRequest.current === requestId) setLoading(false);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [query, showSuggestions]);

  const handleSelectSuggestion = (s) => {
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    const newPos = { lat, lng: lon };
    
    setPosition(newPos);
    setQuery(s.display_name);
    setShowSuggestions(false);

    // Pass data up
    onLocationChange({
      address: s.display_name,
      lat,
      lng: lon,
      city: s.address.city || s.address.town || s.address.state || '',
      area: s.address.suburb || s.address.neighbourhood || s.address.residential || s.address.county || ''
    });
  };

  const handleMarkerDragEnd = async (newLatLng) => {
    setPosition(newLatLng);
    
    try {
      // Reverse geocoding to update text fields as assistance
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: newLatLng.lat,
          lon: newLatLng.lng,
          format: 'json',
          addressdetails: 1
        }
      });

      if (res.data) {
        const addr = res.data.address;
        onLocationChange({
          address: res.data.display_name,
          lat: newLatLng.lat,
          lng: newLatLng.lng,
          city: addr.city || addr.town || addr.state || '',
          area: addr.suburb || addr.neighbourhood || addr.residential || addr.county || '',
          isReverse: true // Flag to indicate this came from a pin drag
        });
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
      // Still update lat/lng even if reverse fails
      onLocationChange({
        lat: newLatLng.lat,
        lng: newLatLng.lng,
        isReverse: true
      });
    }
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="location-picker-container" style={{ marginBottom: '1.5rem' }}>
      <label className="auth-label">Charger Location <span style={{ color: 'var(--brand-cyan)' }}>*</span></label>
      
      {/* Search Input Area */}
      <div className="search-box-wrapper" ref={searchRef} style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="auth-input"
            style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            placeholder="Search for address (e.g. Clifton, Karachi)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
          />
          <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          {query && (
            <button 
              onClick={() => { setQuery(''); setSuggestions([]); }}
              style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || loading) && (
          <div className="suggestions-dropdown" style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px',
            marginTop: '4px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            {loading && <div style={{ padding: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Searching...</div>}
            {suggestions.map((s) => (
              <div 
                key={s.place_id} 
                className="suggestion-item"
                onClick={() => handleSelectSuggestion(s)}
                style={{ 
                  padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '10px'
                }}
              >
                <MapPin size={14} style={{ marginTop: '3px', flexShrink: 0, color: 'var(--brand-green)' }} />
                <span>{s.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Preview */}
      <div className="map-preview-container" style={{ 
        height: '300px', borderRadius: '12px', overflow: 'hidden', 
        border: '1px solid var(--border-color)', position: 'relative' 
      }}>
        <MapContainer 
          center={[position.lat, position.lng]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} onDragEnd={handleMarkerDragEnd} />
          <RecenterMap position={position} />
        </MapContainer>
        
        {/* Help tooltip */}
        <div style={{
          position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px',
          fontSize: '0.7rem', color: '#fff', pointerEvents: 'none'
        }}>
          💡 Drag the pin to your exact parking spot
        </div>
      </div>
    </div>
  );
};

export default ListingLocationPicker;
