// Accommodation Fetcher - OSM Overpass API
import fetch from 'node-fetch';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Suche Wohnmobilstellplätze in einem Radius
 */
export async function searchAccommodations(lat, lon, radiusKm = 50, options = {}) {
  const {
    types = ['stellplatz', 'campsite', 'parking'],
    maxPrice = null,
    freeOnly = false
  } = options;

  // Bounding Box berechnen (ungefähr)
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
  
  const south = lat - latDelta;
  const north = lat + latDelta;
  const west = lon - lonDelta;
  const east = lon + lonDelta;

  // Overpass Query
  const query = `
[out:json][timeout:25];
(
  // Wohnmobilstellplätze
  node["tourism"="caravan_site"](${south},${west},${north},${east});
  way["tourism"="caravan_site"](${south},${west},${north},${east});
  
  // Campingplätze
  node["tourism"="camp_site"](${south},${west},${north},${east});
  way["tourism"="camp_site"](${south},${west},${north},${east});
  
  // Parkplätze für Wohnmobile
  node["amenity"="parking"]["caravan"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["caravan"="yes"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse OSM-Elemente
    const accommodations = parseOSMElements(data.elements, lat, lon);
    
    // Filter nach Präferenzen
    let filtered = accommodations;
    
    if (freeOnly) {
      filtered = filtered.filter(a => a.price === 0);
    } else if (maxPrice !== null) {
      filtered = filtered.filter(a => a.price === null || a.price <= maxPrice);
    }
    
    // Sortiere nach Distanz
    filtered.sort((a, b) => a.distance - b.distance);
    
    return filtered;
    
  } catch (error) {
    console.error('Accommodation search error:', error);
    throw error;
  }
}

/**
 * Parse OSM-Elemente zu Accommodation-Objekten
 */
function parseOSMElements(elements, centerLat, centerLon) {
  const accommodations = [];
  const ways = {};
  
  // Sammle Ways
  elements.forEach(el => {
    if (el.type === 'way') {
      ways[el.id] = el;
    }
  });
  
  elements.forEach(el => {
    if (el.type === 'node' && el.tags) {
      const acc = parseAccommodation(el, centerLat, centerLon);
      if (acc) accommodations.push(acc);
    } else if (el.type === 'way' && el.tags) {
      // Berechne Zentrum der Way (falls Nodes vorhanden)
      if (el.nodes && el.nodes.length > 0) {
        const centerNode = elements.find(n => n.id === el.nodes[0]);
        if (centerNode) {
          const acc = parseAccommodation({
            ...el,
            lat: centerNode.lat,
            lon: centerNode.lon
          }, centerLat, centerLon);
          if (acc) accommodations.push(acc);
        }
      }
    }
  });
  
  return accommodations;
}

/**
 * Parse einzelnes OSM-Element
 */
function parseAccommodation(element, centerLat, centerLon) {
  const tags = element.tags;
  
  // Bestimme Typ
  let type = 'stellplatz';
  if (tags.tourism === 'camp_site') {
    type = 'campsite';
  } else if (tags.amenity === 'parking') {
    type = 'parking';
  }
  
  // Bestimme Preis
  let price = null;
  if (tags.fee === 'no') {
    price = 0;
  } else if (tags.charge) {
    // Parse Preis aus charge-Tag (z.B. "10 EUR", "5-15 EUR")
    const match = tags.charge.match(/(\d+)/);
    if (match) {
      price = parseFloat(match[1]);
    }
  }
  
  // Features
  const features = {
    electricity: tags.electricity === 'yes' || tags['charge:electric'] === 'yes',
    water: tags.drinking_water === 'yes' || tags.water === 'yes',
    disposal: tags.sanitary_dump_station === 'yes' || tags.disposal === 'yes',
    wifi: tags.internet_access === 'yes' || tags.wifi === 'yes',
    toilet: tags.toilets === 'yes',
    shower: tags.shower === 'yes'
  };
  
  // Kontakt
  const contact = {};
  if (tags.phone) contact.phone = tags.phone;
  if (tags.email) contact.email = tags.email;
  if (tags.website) contact.website = tags.website;
  
  // Distanz berechnen
  const distance = haversine(centerLat, centerLon, element.lat, element.lon);
  
  return {
    osm_id: `${element.type}/${element.id}`,
    name: tags.name || `${type} ${element.id}`,
    type,
    lat: element.lat,
    lon: element.lon,
    price,
    capacity: tags.capacity ? parseInt(tags.capacity) : null,
    features,
    contact: Object.keys(contact).length > 0 ? contact : null,
    opening_hours: tags.opening_hours || null,
    description: tags.description || null,
    source: 'osm',
    distance: Math.round(distance * 10) / 10
  };
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

/**
 * Speichere Accommodation in DB (wenn noch nicht vorhanden)
 */
export async function saveAccommodation(pool, accommodation) {
  try {
    const result = await pool.query(
      `INSERT INTO accommodations (
        osm_id, name, type, lat, lon, price, capacity, 
        features, contact, opening_hours, description, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (osm_id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        price = EXCLUDED.price,
        capacity = EXCLUDED.capacity,
        features = EXCLUDED.features,
        contact = EXCLUDED.contact,
        opening_hours = EXCLUDED.opening_hours,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING id`,
      [
        accommodation.osm_id,
        accommodation.name,
        accommodation.type,
        accommodation.lat,
        accommodation.lon,
        accommodation.price,
        accommodation.capacity,
        JSON.stringify(accommodation.features),
        accommodation.contact ? JSON.stringify(accommodation.contact) : null,
        accommodation.opening_hours,
        accommodation.description,
        accommodation.source
      ]
    );
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Save accommodation error:', error);
    return null;
  }
}
