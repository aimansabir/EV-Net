import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X, LocateFixed, Loader2 } from 'lucide-react';
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
 * RecenterMap — updates map view when position changes
 */
const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16);
  }, [position, map]);
  return null;
};

/**
 * DraggableMarker
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

/**
 * Shared reverse-geocoding helper — converts lat/lng to address object via Nominatim
 */
async function reverseGeocode(lat, lng) {
  const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon: lng, format: 'json', addressdetails: 1 },
    headers: { 'Accept-Language': 'en' }
  });
  const addr = res.data?.address || {};
  return {
    address: res.data?.display_name || '',
    lat,
    lng,
    city: addr.city || addr.town || addr.state_district || addr.state || '',
    area: addr.suburb || addr.neighbourhood || addr.residential || addr.county || addr.district || ''
  };
}

const ListingLocationPicker = ({
  initialValue = '',
  initialLat = 24.8607, // default Karachi
  initialLng = 67.0011,
  onLocationChange,
  forceError = false
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [gpsError, setGpsError] = useState('');
  const searchRef = useRef(null);
  const lastRequest = useRef(0);
  const hasGps = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Debounce Nominatim search
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
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q: query, format: 'json', addressdetails: 1, limit: 5, countrycodes: 'pk' },
          headers: { 'Accept-Language': 'en' }
        });
        if (lastRequest.current === requestId) setSuggestions(res.data);
      } catch (err) {
        console.error('Geocoding error:', err);
      } finally {
        if (lastRequest.current === requestId) setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [query, showSuggestions]);

  const handleSelectSuggestion = (s) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setPosition({ lat, lng });
    setQuery(s.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    onLocationChange({
      address: s.display_name,
      lat,
      lng,
      city: s.address?.city || s.address?.town || s.address?.state || '',
      area: s.address?.suburb || s.address?.neighbourhood || s.address?.residential || s.address?.county || ''
    });
  };

  const handleMarkerDragEnd = async (newLatLng) => {
    setPosition(newLatLng);
    try {
      const loc = await reverseGeocode(newLatLng.lat, newLatLng.lng);
      setQuery(loc.address);
      onLocationChange({ ...loc, isReverse: true });
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      onLocationChange({ lat: newLatLng.lat, lng: newLatLng.lng, isReverse: true });
    }
  };

  /**
   * GPS — use browser geolocation, then reverse-geocode to populate all fields
   */
  const handleUseMyLocation = () => {
    if (!hasGps) return;
    setGpsStatus('loading');
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const loc = await reverseGeocode(lat, lng);
          setPosition({ lat, lng });
          setQuery(loc.address);
          setGpsStatus('idle');
          onLocationChange(loc);
        } catch (err) {
          console.error('GPS reverse geocode failed:', err);
          setPosition({ lat, lng });
          setGpsStatus('idle');
          onLocationChange({ lat, lng });
        }
      },
      (err) => {
        setGpsStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location access denied. Please turn on location permissions in your browser settings to use this feature, or search manually.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Location unavailable. Try searching manually.');
        } else {
          setGpsError('Could not get location. Please search manually.');
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
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
      <label className="auth-label">
        Charger Location <span style={{ color: 'var(--brand-cyan)' }}>*</span>
      </label>

      {/* GPS Button */}
      {hasGps && (
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsStatus === 'loading'}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '0.75rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            background: gpsStatus === 'loading' ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 240, 255, 0.08)',
            color: 'var(--brand-cyan)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: gpsStatus === 'loading' ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            opacity: gpsStatus === 'loading' ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (gpsStatus !== 'loading') e.currentTarget.style.background = 'rgba(0, 240, 255, 0.15)'; }}
          onMouseLeave={e => { if (gpsStatus !== 'loading') e.currentTarget.style.background = 'rgba(0, 240, 255, 0.08)'; }}
        >
          {gpsStatus === 'loading'
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <LocateFixed size={15} />
          }
          {gpsStatus === 'loading' ? 'Locating you...' : 'Use My Current Location'}
        </button>
      )}

      {/* GPS Error */}
      {gpsStatus === 'error' && (
        <p style={{ fontSize: '0.78rem', color: '#fb7185', marginBottom: '0.6rem', marginTop: '-0.4rem' }}>
          {gpsError}
        </p>
      )}

      {/* Search Input */}
      <div className="search-box-wrapper" ref={searchRef} style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="auth-input"
            style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            placeholder="Or search address (e.g. Clifton Block 5, Karachi)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
          />
          <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          {query && (
            <button
              type="button"
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

      {forceError && !query && (
        <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: '1rem' }}>
          Please search for and select your location.
        </p>
      )}

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

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ListingLocationPicker;
