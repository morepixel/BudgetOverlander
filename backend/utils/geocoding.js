// Geocoding Service - Nominatim (OSM)
import fetch from 'node-fetch';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Geocode: Adresse → Koordinaten
 */
export async function geocodeAddress(address) {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: 5
    });
    
    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        'User-Agent': 'Budget-Overlander-App/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error('Geocoding fehlgeschlagen');
    }
    
    const results = await response.json();
    
    return results.map(r => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      type: r.type,
      importance: r.importance
    }));
    
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Reverse Geocode: Koordinaten → Adresse
 */
export async function reverseGeocode(lat, lon) {
  try {
    const params = new URLSearchParams({
      lat,
      lon,
      format: 'json'
    });
    
    const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: {
        'User-Agent': 'Budget-Overlander-App/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error('Reverse geocoding fehlgeschlagen');
    }
    
    const result = await response.json();
    
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      address: result.address
    };
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}
