/**
 * EV-Net — Global City Coordinates registry
 * 
 * Provides fallback coordinates for broad-area map views when
 * exact coordinates are protected by privacy/RLS.
 */

export const cityCoordinates = {
  'Lahore': { lat: 31.5204, lng: 74.3587 },
  'Karachi': { lat: 24.8607, lng: 67.0011 },
  'Islamabad': { lat: 33.6844, lng: 73.0479 },
  'Faisalabad': { lat: 31.4504, lng: 73.1350 },
  'Rawalpindi': { lat: 33.5651, lng: 73.0169 },
  'Multan': { lat: 30.1575, lng: 71.5249 },
  'Peshawar': { lat: 34.0151, lng: 71.5249 },
  'Quetta': { lat: 30.1798, lng: 66.9750 },
  'Gujranwala': { lat: 32.1877, lng: 74.1945 },
  'Sialkot': { lat: 32.4945, lng: 74.5229 },
};

export const getFuzzyCoordinates = (city, listingLat, listingLng) => {
  // If we have actual coordinates (verified user), use them with a slight offset for "broad" view.
  if (listingLat && listingLng) {
    return [listingLat + 0.002, listingLng - 0.002];
  }
  
  // Fallback to city center
  const coords = cityCoordinates[city];
  if (coords) return [coords.lat, coords.lng];
  
  // Ultimate fallback (Pakistan center-ish)
  return [30.3753, 69.3451];
};
