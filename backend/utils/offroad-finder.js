// Offroad Track Finder - Nutzt Overpass API für realistische Offroad-Strecken
import fetch from 'node-fetch';
import pool from '../database/db-postgres.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

/**
 * Finde Offroad-Tracks in einem Gebiet (mit Cache)
 */
export async function findOffroadTracks(lat, lon, radiusKm = 50) {
  const regionKey = `lat_${lat.toFixed(1)}_lon_${lon.toFixed(1)}_radius_${radiusKm}`;
  
  // 1. Prüfe Cache
  try {
    const cacheResult = await pool.query(
      `SELECT tracks, total_km, avg_difficulty, track_count 
       FROM offroad_cache 
       WHERE region_key = $1 AND expires_at > NOW()`,
      [regionKey]
    );
    
    if (cacheResult.rows.length > 0) {
      console.log(`✅ Cache HIT für ${regionKey}`);
      const cached = cacheResult.rows[0];
      return {
        tracks: cached.tracks,
        totalKm: parseFloat(cached.total_km),
        avgDifficulty: cached.avg_difficulty,
        cached: true
      };
    }
    
    console.log(`❌ Cache MISS für ${regionKey} - Rufe Overpass API auf...`);
  } catch (error) {
    console.error('Cache lookup error:', error);
  }
  
  // 2. Kein Cache → Overpass API aufrufen
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
      const result = processOffroadData(data);
      
      // 3. Speichere im Cache
      try {
        await pool.query(
          `INSERT INTO offroad_cache (region_key, center_lat, center_lon, radius_km, tracks, total_km, avg_difficulty, track_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (region_key) DO UPDATE SET
             tracks = EXCLUDED.tracks,
             total_km = EXCLUDED.total_km,
             avg_difficulty = EXCLUDED.avg_difficulty,
             track_count = EXCLUDED.track_count,
             created_at = NOW(),
             expires_at = NOW() + INTERVAL '30 days'`,
          [
            regionKey,
            lat,
            lon,
            radiusKm,
            JSON.stringify(result.tracks),
            result.totalKm,
            result.avgDifficulty,
            result.tracks.length
          ]
        );
        console.log(`💾 Cache gespeichert für ${regionKey}`);
      } catch (error) {
        console.error('Cache save error:', error);
      }
      
      return { ...result, cached: false };
    } catch (error) {
      console.error(`Overpass endpoint ${endpoint} failed:`, error.message);
      continue;
    }
  }

  return { tracks: [], totalKm: 0, avgDifficulty: 0, cached: false };
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
