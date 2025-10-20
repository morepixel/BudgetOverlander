// Park4Night API Fetcher
import fetch from 'node-fetch';

const PARK4NIGHT_API = 'https://guest.park4night.com/services/V4.1/lieuxGetFilter.php';

/**
 * Suche Übernachtungsplätze via Park4Night API
 */
export async function searchPark4Night(lat, lon, options = {}) {
  const {
    maxResults = 50,
    maxPrice = null,
    freeOnly = false
  } = options;

  try {
    const url = `${PARK4NIGHT_API}?latitude=${lat}&longitude=${lon}`;
    
    console.log('🅿️ Park4Night API Request:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BudgetOverlander/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Park4Night API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Park4Night gibt Daten im "lieux" Array zurück
    const places = data.lieux || [];
    
    console.log('🅿️ Park4Night Response:', places.length, 'places');
    
    // Parse zu unserem Format
    const accommodations = places.map(place => parsePark4NightPlace(place, lat, lon))
      .filter(acc => acc !== null);
    
    // Filter nach Präferenzen
    let filtered = accommodations;
    
    if (freeOnly) {
      filtered = filtered.filter(a => a.price === 0);
    } else if (maxPrice !== null) {
      filtered = filtered.filter(a => a.price === null || a.price <= maxPrice);
    }
    
    // Sortiere nach Distanz
    filtered.sort((a, b) => a.distance - b.distance);
    
    // Limitiere Ergebnisse
    return filtered.slice(0, maxResults);
    
  } catch (error) {
    console.error('Park4Night API error:', error);
    return [];
  }
}

/**
 * Parse Park4Night Place zu unserem Format
 */
function parsePark4NightPlace(place, centerLat, centerLon) {
  try {
    // Preis aus prix_stationnement
    let price = null;
    if (place.prix_stationnement === 'gratuit' || place.prix_stationnement === 'free') {
      price = 0;
    } else if (place.prix_stationnement && place.prix_stationnement !== 'payant') {
      // Versuche Preis zu extrahieren
      const match = place.prix_stationnement.match(/(\d+)/);
      if (match) {
        price = parseFloat(match[1]);
      }
    }
    
    // Features
    const features = {
      electricity: place.electricite === '1' || place.point_eau === '1',
      water: place.point_eau === '1',
      disposal: place.eau_usee === '1' || place.eau_noire === '1',
      wifi: false,
      toilet: place.wc_public === '1',
      shower: place.douche === '1'
    };
    
    // Distanz berechnen
    const distance = haversine(centerLat, centerLon, parseFloat(place.latitude), parseFloat(place.longitude));
    
    return {
      p4n_id: place.id,
      name: place.titre || place.name || `Park4Night ${place.id}`,
      type: 'parking',
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      price,
      capacity: place.nb_places ? parseInt(place.nb_places) : null,
      features,
      rating: place.note_moyenne ? parseFloat(place.note_moyenne) : null,
      reviews_count: place.nb_commentaires ? parseInt(place.nb_commentaires) : 0,
      description: place.description_de || place.description_en || place.description_fr || null,
      source: 'park4night',
      distance: Math.round(distance * 10) / 10,
      url: `https://park4night.com/place/${place.id}`
    };
  } catch (error) {
    console.error('Parse Park4Night place error:', error);
    return null;
  }
}

/**
 * Haversine-Distanz in km
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
