import React from 'react';
import { TileLayer } from 'react-leaflet';

/**
 * Shared basemap for every Leaflet map in the app.
 *
 * Default: OpenStreetMap's standard tiles (free, no API key), darkened with a
 * CSS filter (`.evnet-dark-tiles` in index.css) to match the site theme.
 * CARTO's dark basemap used to be used here, but it now requires an API key
 * and serves "API KEY REQUIRED" tiles without one.
 *
 * To use a keyed provider instead (e.g. Stadia, MapTiler, CARTO), set
 * VITE_MAP_TILE_URL (and optionally VITE_MAP_TILE_ATTRIBUTION). Custom tiles
 * are shown as-is, without the dark filter.
 */
const CUSTOM_URL = import.meta.env.VITE_MAP_TILE_URL;
const CUSTOM_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION;

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BaseMapTiles = ({ variant = 'dark' }) => {
  if (CUSTOM_URL) {
    return (
      <TileLayer
        url={CUSTOM_URL}
        attribution={CUSTOM_ATTRIBUTION || OSM_ATTRIBUTION}
        maxZoom={19}
      />
    );
  }

  return (
    <TileLayer
      url={OSM_URL}
      attribution={OSM_ATTRIBUTION}
      maxZoom={19}
      className={variant === 'dark' ? 'evnet-dark-tiles' : undefined}
    />
  );
};

export default BaseMapTiles;
