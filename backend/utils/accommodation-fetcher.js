// Accommodation Fetcher - OSM Overpass API + Park4Night
import fetch from 'node-fetch';
import { searchPark4Night } from './park4night-fetcher.js';

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

  // Overpass Query - erweitert um mehr Übernachtungsmöglichkeiten
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
  node["amenity"="parking"]["motorhome"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["motorhome"="yes"](${south},${west},${north},${east});
  
  // Öffentliche Parkplätze (generell)
  node["amenity"="parking"]["access"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["access"="yes"](${south},${west},${north},${east});
  
  // Friedhöfe (oft erlaubt für Wohnmobile)
  node["amenity"="grave_yard"](${south},${west},${north},${east});
  way["amenity"="grave_yard"](${south},${west},${north},${east});
  node["landuse"="cemetery"](${south},${west},${north},${east});
  way["landuse"="cemetery"](${south},${west},${north},${east});
  
  // Rastplätze
  node["highway"="rest_area"](${south},${west},${north},${east});
  way["highway"="rest_area"](${south},${west},${north},${east});
  node["highway"="services"](${south},${west},${north},${east});
  way["highway"="services"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
  `;

  try {
    // Parallel: OSM + Park4Night
    const [osmResults, p4nResults] = await Promise.all([
      // OSM Overpass
      fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      }).then(res => res.ok ? res.json() : { elements: [] })
        .then(data => parseOSMElements(data.elements, lat, lon))
        .catch(err => {
          console.error('OSM error:', err);
          return [];
        }),
      
      // Park4Night
      searchPark4Night(lat, lon, { maxPrice, freeOnly })
        .catch(err => {
          console.error('Park4Night error:', err);
          return [];
        })
    ]);
    
    // Kombiniere Ergebnisse
    const allAccommodations = [...osmResults, ...p4nResults];
    
    // Dedupliziere basierend auf Distanz (< 100m = gleicher Platz)
    const unique = [];
    for (const acc of allAccommodations) {
      const isDuplicate = unique.some(u => 
        haversine(u.lat, u.lon, acc.lat, acc.lon) < 0.1
      );
      if (!isDuplicate) {
        unique.push(acc);
      }
    }
    
    // Filter nach Präferenzen
    let filtered = unique;
    
    if (freeOnly) {
      filtered = filtered.filter(a => a.price === 0);
    } else if (maxPrice !== null) {
      filtered = filtered.filter(a => a.price === null || a.price <= maxPrice);
    }
    
    // Sortiere nach Distanz
    filtered.sort((a, b) => a.distance - b.distance);
    
    console.log(`✅ Found ${filtered.length} accommodations (${osmResults.length} OSM + ${p4nResults.length} P4N)`);
    
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
  let type = 'parking';
  if (tags.tourism === 'camp_site') {
    type = 'campsite';
  } else if (tags.tourism === 'caravan_site') {
    type = 'stellplatz';
  } else if (tags.amenity === 'parking') {
    type = 'parking';
  } else if (tags.amenity === 'grave_yard' || tags.landuse === 'cemetery') {
    type = 'parking'; // Friedhof als Parking
  } else if (tags.highway === 'rest_area' || tags.highway === 'services') {
    type = 'rest_area';
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
