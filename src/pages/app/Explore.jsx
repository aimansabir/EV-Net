import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { listingService } from '../../data/api';
import useAppStore from '../../store/appStore';
import { formatPKR } from '../../data/feeConfig';
import { getFuzzyCoordinates } from '../../data/cityCoordinates';
import { Search, MapPin, Settings2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './Explore.css';

const DEFAULT_CENTER = [24.8607, 67.0011]; // default Karachi
const DEFAULT_ZOOM = 12;
const MARKER_OPTIONS = {
  color: '#00F0A8',
  fillColor: '#00D26A',
  fillOpacity: 0.95,
  opacity: 1,
  weight: 3,
};
const SELECTED_MARKER_OPTIONS = {
  ...MARKER_OPTIONS,
  color: '#00F0FF',
  fillColor: '#00F0FF',
};
const MARKER_HALO_OPTIONS = {
  color: '#00F0A8',
  fillColor: '#00F0A8',
  fillOpacity: 0.18,
  opacity: 0.55,
  weight: 1,
};

const parseCoordinate = (value) => {
  const coord = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(coord) ? coord : null;
};

const hashString = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getStableOffset = (key, radius) => {
  const hash = hashString(key);
  const angle = (hash % 360) * (Math.PI / 180);
  const ring = 0.45 + ((hash % 7) / 12);

  return [
    Math.sin(angle) * radius * ring,
    Math.cos(angle) * radius * ring,
  ];
};

const getListingMapPosition = (listing) => {
  const lat = parseCoordinate(listing.lat);
  const lng = parseCoordinate(listing.lng);
  const hasPublicCoords = lat !== null && lng !== null;
  const [baseLat, baseLng] = getFuzzyCoordinates(
    listing.city,
    hasPublicCoords ? lat : null,
    hasPublicCoords ? lng : null
  );
  const key = listing.id || `${listing.city}-${listing.area}-${listing.title}`;
  const [offsetLat, offsetLng] = getStableOffset(key, hasPublicCoords ? 0.0015 : 0.008);

  return [baseLat + offsetLat, baseLng + offsetLng];
};

const MapBoundsUpdater = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) return;

    if (positions.length === 1) {
      map.setView(positions[0], DEFAULT_ZOOM, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(positions), {
      padding: [80, 80],
      maxZoom: DEFAULT_ZOOM,
    });
  }, [map, positions]);

  return null;
};

// Fake "available now" times for demo realism
const getAvailabilityText = (listing) => {
  const now = new Date();
  const hour = now.getHours();
  if (listing.chargerSpeed === '50kW' || listing.chargerSpeed === '22kW') return 'Available Now';
  if (hour < 18) {
    const displayHour = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `Available ${displayHour}${ampm} - 8:00 PM`;
  }
  return 'Available Tomorrow';
};

const Explore = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [chargers, setChargers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const isMounted = true;
  const { favorites, loadFavorites, toggleFavorite } = useAppStore();

  useEffect(() => {
    const load = async () => {
      await loadFavorites();
      const data = await listingService.getAll({ isActive: true, isApproved: true });
      setChargers(data);
    };
    load();
  }, [loadFavorites]);

  const filters = [
    { key: 'All', label: 'All Chargers' },
    { key: 'Fast', label: 'Fast Charging (22kW+)' },
    { key: 'Available', label: 'Available Now' },
    { key: 'TopRated', label: 'Top Rated Hosts' },
  ];

  const filtered = useMemo(() => chargers.filter(c => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.area.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === 'Fast') return c.chargerSpeed === '22kW' || c.chargerSpeed === '50kW';
    if (activeFilter === 'TopRated') return c.rating >= 4.5;
    if (activeFilter === 'Available') return true; // All demo chargers are "available"
    return true;
  }), [activeFilter, chargers, search]);

  const mapChargers = useMemo(() => (
    filtered.map(charger => ({
      charger,
      position: getListingMapPosition(charger),
    }))
  ), [filtered]);

  const mapPositions = useMemo(() => (
    mapChargers.map(({ position }) => position)
  ), [mapChargers]);

  const handleFavorite = async (e, listingId) => {
    e.stopPropagation();
    await toggleFavorite(listingId);
  };

  const handleCardClick = (charger) => {
    setSelectedId(charger.id);
    navigate(`/app/charger/${charger.id}`);
  };

  return (
    <div className="explore-container">

      {/* Sidebar */}
      <div className="explore-sidebar">
        <div className="explore-filters">
          <div className="search-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Search location, area..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className={`filter-toggle-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Settings2 size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="filter-pills">
              {filters.map(f => (
                <button
                  key={f.key}
                  className={`filter-pill ${activeFilter === f.key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="explore-list">
          <div className="explore-list-count">{filtered.length} chargers found</div>

          {filtered.map(charger => {
            const availText = getAvailabilityText(charger);
            const isSelected = selectedId === charger.id;
            return (
              <div
                key={charger.id}
                className={`charger-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCardClick(charger)}
              >
                <div className="cc-header">
                  <div className="cc-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={16} color="var(--brand-green)" /> {charger.title}
                  </div>
                  <button
                    className={`cc-fav-btn ${favorites.has(charger.id) ? 'active' : ''}`}
                    onClick={(e) => handleFavorite(e, charger.id)}
                  >
                    {favorites.has(charger.id) ? '♥' : '♡'}
                  </button>
                </div>

                <div className="cc-meta">
                  <span className="cc-speed-badge">{charger.chargerSpeed}</span>
                  <span>•</span>
                  <span className="cc-availability">{availText}</span>
                </div>

                <div className="cc-bottom">
                  <div className="cc-price" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {charger.priceDay ? (
                      <>
                        <div style={{ fontSize: '1.1rem', color: 'var(--brand-green)', lineHeight: 1 }}>
                          {formatPKR(charger.priceDay)} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ kWh (Day)</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {formatPKR(charger.priceNight)} <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>/ kWh (Night)</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '1.1rem', color: 'var(--brand-green)', lineHeight: 1 }}>
                        {formatPKR(charger.pricePerHour)} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ hr</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {charger.rating > 0 && (
                      <div className="cc-rating">
                        <span className="star">★</span> {charger.rating}
                      </div>
                    )}
                    <button
                      className="cc-book-btn"
                      onClick={(e) => { e.stopPropagation(); navigate(`/app/book/${charger.id}`); }}
                    >
                      Book
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="explore-map">
        {isMounted ? (
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%', background: '#0b0f19' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            />
            <MapBoundsUpdater positions={mapPositions} />
            {mapChargers.map(({ charger, position }) => {
              return (
                <React.Fragment key={charger.id}>
                  <CircleMarker
                    center={position}
                    radius={selectedId === charger.id ? 28 : 22}
                    pathOptions={MARKER_HALO_OPTIONS}
                    interactive={false}
                  />
                  <CircleMarker
                  center={position}
                  radius={selectedId === charger.id ? 14 : 11}
                  pathOptions={selectedId === charger.id ? SELECTED_MARKER_OPTIONS : MARKER_OPTIONS}
                  eventHandlers={{
                    click: () => setSelectedId(charger.id),
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="mc-header">{charger.title}</div>
                    <div className="mc-details">{charger.chargerSpeed} • {charger.area}</div>
                    <div style={{ color: 'var(--brand-green)', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.9rem' }}>
                      {charger.priceDay ? `${formatPKR(charger.priceDay)}/${formatPKR(charger.priceNight)} per kWh` : `${formatPKR(charger.pricePerHour)} per hour`}
                    </div>
                    <button className="mc-btn" onClick={() => navigate(`/app/charger/${charger.id}`)}>
                      View Details
                    </button>
                  </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        ) : (
          <div className="map-placeholder">
            <div className="spinner-glow"></div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Explore;
