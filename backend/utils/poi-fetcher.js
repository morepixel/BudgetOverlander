// POI Fetcher - Lädt Points of Interest aus OpenStreetMap
import fetch from 'node-fetch';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// POI-Typen und ihre OSM-Tags
const POI_TYPES = {
  water: {
    name: 'Wasser',
    icon: '💧',
    query: `
      node["amenity"="drinking_water"]({{bbox}});
      node["natural"="spring"]["drinking_water"!="no"]({{bbox}});
      node["man_made"="water_well"]({{bbox}});
    `
  },
  disposal: {
    name: 'Entsorgung',
    icon: '🚮',
    query: `
      node["amenity"="waste_disposal"]({{bbox}});
      node["amenity"="sanitary_dump_station"]({{bbox}});
    `
  },
  camping: {
    name: 'Camping',
    icon: '🏕️',
    query: `
      node["tourism"="camp_site"]({{bbox}});
      node["tourism"="caravan_site"]({{bbox}});
      way["tourism"="camp_site"]({{bbox}});
      way["tourism"="caravan_site"]({{bbox}});
    `
  },
  fuel: {
    name: 'Tankstelle',
    icon: '⛽',
    query: `
      node["amenity"="fuel"]({{bbox}});
      way["amenity"="fuel"]({{bbox}});
    `
  },
  viewpoint: {
    name: 'Aussichtspunkt',
    icon: '👁️',
    query: `
      node["tourism"="viewpoint"]({{bbox}});
    `
  }
};

// POIs in Bounding Box laden
export async function fetchPOIs(bbox, types = ['water', 'disposal', 'camping']) {
  const [south, west, north, east] = bbox;
  const bboxString = `${south},${west},${north},${east}`;
  
  const results = {};
  
  for (const type of types) {
    if (!POI_TYPES[type]) continue;
    
    try {
      const pois = await fetchPOIType(type, bboxString);
      results[type] = pois;
    } catch (error) {
      console.error(`Fehler beim Laden von ${type} POIs:`, error.message);
      results[type] = [];
    }
  }
  
  return results;
}

// Einzelnen POI-Typ laden
async function fetchPOIType(type, bboxString) {
  const poiConfig = POI_TYPES[type];
  const query = `[out:json][timeout:25];(${poiConfig.query.replace(/{{bbox}}/g, bboxString)});out body geom;`;
  
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  
  if (!response.ok) {
    throw new Error(`Overpass API Fehler: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.elements.map(element => {
    let lat, lon;
    
    if (element.type === 'node') {
      lat = element.lat;
      lon = element.lon;
    } else if (element.type === 'way' && element.center) {
      lat = element.center.lat;
      lon = element.center.lon;
    } else if (element.type === 'way' && element.geometry) {
      // Berechne Zentrum aus Geometrie
      const lats = element.geometry.map(p => p.lat);
      const lons = element.geometry.map(p => p.lon);
      lat = lats.reduce((a, b) => a + b, 0) / lats.length;
      lon = lons.reduce((a, b) => a + b, 0) / lons.length;
    }
    
    return {
      id: element.id,
      type: type,
      name: element.tags?.name || poiConfig.name,
      icon: poiConfig.icon,
      lat: lat,
      lon: lon,
      tags: element.tags || {}
    };
  }).filter(poi => poi.lat && poi.lon);
}

// POIs in Radius um Punkt finden
export async function fetchPOIsNearPoint(lat, lon, radiusKm = 50, types = ['water', 'disposal', 'camping']) {
  // Berechne Bounding Box
  const latDelta = radiusKm / 111; // ca. 111km pro Grad
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  
  const bbox = [
    lat - latDelta,  // south
    lon - lonDelta,  // west
    lat + latDelta,  // north
    lon + lonDelta   // east
  ];
  
  return fetchPOIs(bbox, types);
}

// POIs entlang Route finden
export async function fetchPOIsAlongRoute(clusters, radiusKm = 20, types = ['water', 'disposal', 'camping']) {
  // Berechne Bounding Box um alle Cluster
  const lats = clusters.map(c => c.center.lat);
  const lons = clusters.map(c => c.center.lon);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  
  // Erweitere um Radius
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180));
  
  const bbox = [
    minLat - latDelta,
    minLon - lonDelta,
    maxLat + latDelta,
    maxLon + lonDelta
  ];
  
  return fetchPOIs(bbox, types);
}
