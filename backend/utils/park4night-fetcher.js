// Park4Night API Fetcher
import fetch from 'node-fetch';

/**
 * Suche Park4Night Plätze in der Nähe
 */
export async function searchPark4Night(lat, lon, options = {}) {
  const { freeOnly = false, radius = 50 } = options;
  
  try {
    // Park4Night API (öffentliche Daten)
    // Hinweis: Dies ist ein vereinfachtes Beispiel. Für Produktivnutzung sollte
    // die offizielle Park4Night API mit API Key verwendet werden.
    
    // Fallback: Verwende OSM Overpass für Stellplätze
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    const radiusMeters = radius * 1000;
    const query = `
[out:json][timeout:25];
(
  node["tourism"="camp_site"](around:${radiusMeters},${lat},${lon});
  node["tourism"="caravan_site"](around:${radiusMeters},${lat},${lon});
  node["amenity"="parking"]["caravan"="yes"](around:${radiusMeters},${lat},${lon});
);
out body;
    `;
    
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });
    
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse Ergebnisse
    const places = data.elements.map(element => {
      const tags = element.tags || {};
      const isFree = !tags.fee || tags.fee === 'no';
      
      // Filter nach freeOnly
      if (freeOnly && !isFree) {
        return null;
      }
      
      return {
        id: element.id,
        p4n_id: `osm_${element.id}`,
        name: tags.name || tags['name:en'] || 'Stellplatz',
        lat: element.lat,
        lon: element.lon,
        type: tags.tourism === 'camp_site' ? 'campsite' : 'parking',
        rating: null,
        reviews_count: null,
        capacity: tags.capacity ? parseInt(tags.capacity) : null,
        features: {
          water: tags.drinking_water === 'yes',
          electricity: tags.electricity === 'yes',
          disposal: tags.sanitary_dump_station === 'yes'
        },
        description: tags.description || '',
        url: `https://www.openstreetmap.org/node/${element.id}`
      };
    }).filter(p => p !== null);
    
    return places;
    
  } catch (error) {
    console.error('Park4Night fetch error:', error);
    return [];
  }
}
