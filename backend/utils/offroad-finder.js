// Offroad Track Finder - Nutzt Overpass API für realistische Offroad-Strecken
import fetch from 'node-fetch';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

/**
 * Finde Offroad-Tracks in einem Gebiet
 */
export async function findOffroadTracks(lat, lon, radiusKm = 50) {
  const radiusMeters = radiusKm * 1000;
  
  const query = `
[out:json][timeout:60];
(
  way["highway"~"^(track|path)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     ["vehicle"!~"^(no|private)$"]
     ["bicycle"!="designated"]
     ["foot"!="designated"]
     (around:${radiusMeters},${lat},${lon});
);
out tags geom;
`;

  // Versuche verschiedene Endpoints
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }).toString(),
      });

      if (!response.ok) continue;

      const data = await response.json();
      return processOffroadData(data);
    } catch (error) {
      console.error(`Overpass endpoint ${endpoint} failed:`, error.message);
      continue;
    }
  }

  return { tracks: [], totalKm: 0, avgDifficulty: 0 };
}

/**
 * Verarbeite Overpass-Daten
 */
function processOffroadData(data) {
  const tracks = [];
  let totalLength = 0;

  data.elements?.forEach(el => {
    if (el.type !== 'way' || !el.geometry) return;

    const length = calculateWayLength(el.geometry);
    const difficulty = estimateDifficulty(el.tags || {});
    
    tracks.push({
      id: el.id,
      name: el.tags?.name || 'Unbenannt',
      length: length / 1000, // km
      difficulty,
      surface: el.tags?.surface || 'unknown',
      tracktype: el.tags?.tracktype || 'unknown',
      geometry: el.geometry,
      tags: el.tags
    });

    totalLength += length;
  });

  return {
    tracks,
    totalKm: totalLength / 1000,
    avgDifficulty: tracks.length > 0 
      ? tracks.reduce((sum, t) => sum + t.difficulty, 0) / tracks.length 
      : 0
  };
}

/**
 * Berechne Weglänge in Metern
 */
function calculateWayLength(geometry) {
  if (!geometry || geometry.length < 2) return 0;
  
  let sum = 0;
  for (let i = 1; i < geometry.length; i++) {
    const p1 = geometry[i - 1];
    const p2 = geometry[i];
    sum += haversine(p1.lat, p1.lon, p2.lat, p2.lon);
  }
  return sum;
}

/**
 * Haversine-Distanz in Metern
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Erdradius in Metern
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Schätze Schwierigkeit basierend auf Tags
 */
function estimateDifficulty(tags) {
  let score = 20; // Basis
  
  const surfaceScores = {
    'gravel': 15,
    'fine_gravel': 10,
    'compacted': 12,
    'ground': 25,
    'dirt': 30,
    'sand': 35,
    'rock': 40
  };
  score += surfaceScores[tags.surface] || 20;
  
  const tracktypeScores = {
    'grade1': 0,
    'grade2': 10,
    'grade3': 20,
    'grade4': 25,
    'grade5': 30
  };
  score += tracktypeScores[tags.tracktype] || 15;
  
  return Math.min(score, 100);
}

/**
 * Berechne realistische Offroad-Prozente für eine Route
 */
export async function calculateOffroadPercentage(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;

  let totalOffroadKm = 0;
  let totalRouteKm = 0;

  // Für jeden Waypoint: Suche Offroad-Tracks in 25km Radius
  for (const wp of waypoints) {
    const result = await findOffroadTracks(wp.lat, wp.lon, 25);
    totalOffroadKm += result.totalKm;
  }

  // Berechne Gesamt-Routenlänge (grobe Schätzung)
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = haversine(
      waypoints[i].lat,
      waypoints[i].lon,
      waypoints[i + 1].lat,
      waypoints[i + 1].lon
    );
    totalRouteKm += dist / 1000;
  }

  // Realistische Prozente: Nicht mehr als verfügbare Tracks
  const maxOffroadKm = Math.min(totalOffroadKm, totalRouteKm * 0.7); // Max 70%
  const offroadPercent = (maxOffroadKm / totalRouteKm) * 100;

  return Math.round(offroadPercent);
}
