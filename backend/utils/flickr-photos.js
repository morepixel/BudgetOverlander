// Flickr API - Geo-basierte Foto-Suche
import fetch from 'node-fetch';

const FLICKR_API_KEY = process.env.FLICKR_API_KEY || 'demo'; // Öffentlicher API Key
const FLICKR_ENDPOINT = 'https://api.flickr.com/services/rest/';

/**
 * Suche Fotos in der Nähe eines Standorts
 */
export async function findPhotosNearLocation(lat, lon, radius = 1, limit = 3) {
  try {
    const params = new URLSearchParams({
      method: 'flickr.photos.search',
      api_key: FLICKR_API_KEY,
      lat: lat,
      lon: lon,
      radius: radius, // km
      radius_units: 'km',
      per_page: limit,
      page: 1,
      format: 'json',
      nojsoncallback: 1,
      extras: 'url_m,url_z,owner_name,date_taken,views,tags',
      sort: 'interestingness-desc', // Beste Fotos zuerst
      content_type: 1, // Nur Fotos (keine Screenshots)
      media: 'photos'
    });

    const response = await fetch(`${FLICKR_ENDPOINT}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Flickr API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.stat !== 'ok' || !data.photos || !data.photos.photo) {
      return [];
    }

    // Formatiere Fotos
    const photos = data.photos.photo.map(photo => ({
      id: photo.id,
      title: photo.title || 'Foto',
      url: photo.url_z || photo.url_m, // Größeres Bild bevorzugen
      thumbnail: photo.url_m,
      author: photo.ownername,
      dateTaken: photo.datetaken,
      views: photo.views,
      flickrUrl: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`
    })).filter(p => p.url); // Nur Fotos mit URL

    return photos;
  } catch (error) {
    console.error('Flickr API error:', error.message);
    return [];
  }
}

/**
 * Suche Fotos für mehrere Standorte (parallel)
 */
export async function findPhotosForLocations(locations, radius = 1, limit = 3) {
  const promises = locations.map(loc => 
    findPhotosNearLocation(loc.lat, loc.lon, radius, limit)
  );
  
  const results = await Promise.all(promises);
  
  // Kombiniere Ergebnisse mit Standorten
  return locations.map((loc, idx) => ({
    ...loc,
    photos: results[idx]
  }));
}
