// Scenic Finder - Nutzt Overpass API für Aussichtspunkte und Panoramastraßen
import fetch from 'node-fetch';
import pool from '../database/db-postgres.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

/**
 * Finde Scenic-Punkte in einem Gebiet (mit Cache)
 */
export async function findScenicPoints(lat, lon, radiusKm = 50) {
  const regionKey = `scenic_lat_${lat.toFixed(1)}_lon_${lon.toFixed(1)}_radius_${radiusKm}`;
  
  // 1. Prüfe Cache
  try {
    const cacheResult = await pool.query(
      `SELECT tracks, total_km, avg_difficulty, track_count 
       FROM offroad_cache 
       WHERE region_key = $1 AND expires_at > NOW()`,
      [regionKey]
    );
    
    if (cacheResult.rows.length > 0) {
      console.log(`✅ Scenic Cache HIT für ${regionKey}`);
      const cached = cacheResult.rows[0];
      return {
        viewpoints: cached.tracks.viewpoints || [],
        scenicRoads: cached.tracks.scenicRoads || [],
        naturalParks: cached.tracks.naturalParks || [],
        cached: true
      };
    }
    
    console.log(`❌ Scenic Cache MISS für ${regionKey} - Rufe Overpass API auf...`);
  } catch (error) {
    console.error('Scenic cache lookup error:', error);
  }
  
  // 2. Kein Cache → Overpass API aufrufen
  const radiusMeters = radiusKm * 1000;
  
  const query = `
[out:json][timeout:60];
(
  // Aussichtspunkte
  node["tourism"="viewpoint"](around:${radiusMeters},${lat},${lon});
  
  // Panoramastraßen
  way["scenic"="yes"](around:${radiusMeters},${lat},${lon});
  way["scenic_value"](around:${radiusMeters},${lat},${lon});
  
  // Naturschutzgebiete & National Parks
  way["leisure"="nature_reserve"](around:${radiusMeters},${lat},${lon});
  relation["leisure"="nature_reserve"](around:${radiusMeters},${lat},${lon});
  way["boundary"="national_park"](around:${radiusMeters},${lat},${lon});
  relation["boundary"="national_park"](around:${radiusMeters},${lat},${lon});
);
out tags center;
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
      const result = processScenicData(data);
      
      // 3. Speichere im Cache
      try {
        await pool.query(
          `INSERT INTO offroad_cache (region_key, center_lat, center_lon, radius_km, tracks, total_km, avg_difficulty, track_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (region_key) DO UPDATE SET
             tracks = EXCLUDED.tracks,
             created_at = NOW(),
             expires_at = NOW() + INTERVAL '30 days'`,
          [
            regionKey,
            lat,
            lon,
            radiusKm,
            JSON.stringify(result),
            0, // total_km nicht relevant für scenic
            0, // avg_difficulty nicht relevant
            result.viewpoints.length + result.scenicRoads.length + result.naturalParks.length
          ]
        );
        console.log(`💾 Scenic Cache gespeichert für ${regionKey}`);
      } catch (error) {
        console.error('Scenic cache save error:', error);
      }
      
      return { ...result, cached: false };
    } catch (error) {
      console.error(`Overpass endpoint ${endpoint} failed:`, error.message);
      continue;
    }
  }

  return { viewpoints: [], scenicRoads: [], naturalParks: [], cached: false };
}

/**
 * Verarbeite Overpass Scenic-Daten
 */
function processScenicData(data) {
  const viewpoints = [];
  const scenicRoads = [];
  const naturalParks = [];

  data.elements?.forEach(el => {
    const tags = el.tags || {};
    
    // Aussichtspunkte
    if (tags.tourism === 'viewpoint') {
      viewpoints.push({
        id: el.id,
        name: tags.name || 'Aussichtspunkt',
        lat: el.lat,
        lon: el.lon,
        elevation: tags.ele ? parseInt(tags.ele) : null,
        description: tags.description || null
      });
    }
    
    // Panoramastraßen
    if (tags.scenic === 'yes' || tags.scenic_value) {
      const geometry = el.geometry || (el.center ? [el.center] : []);
      scenicRoads.push({
        id: el.id,
        name: tags.name || 'Panoramastraße',
        geometry: geometry,
        scenicValue: tags.scenic_value || 'yes',
        highway: tags.highway
      });
    }
    
    // Naturschutzgebiete & National Parks
    if (tags.leisure === 'nature_reserve' || tags.boundary === 'national_park') {
      const center = el.center || { lat: el.lat, lon: el.lon };
      naturalParks.push({
        id: el.id,
        name: tags.name || 'Naturschutzgebiet',
        lat: center.lat,
        lon: center.lon,
        type: tags.boundary === 'national_park' ? 'national_park' : 'nature_reserve',
        description: tags.description || null
      });
    }
  });

  return { viewpoints, scenicRoads, naturalParks };
}

/**
 * Berechne Scenic-Score für eine Route
 */
export async function calculateScenicScore(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;

  let totalViewpoints = 0;
  let totalScenicRoads = 0;
  let totalNaturalParks = 0;

  // Für jeden Waypoint: Suche Scenic-Punkte in 25km Radius
  for (const wp of waypoints) {
    const result = await findScenicPoints(wp.lat, wp.lon, 25);
    totalViewpoints += result.viewpoints.length;
    totalScenicRoads += result.scenicRoads.length;
    totalNaturalParks += result.naturalParks.length;
  }

  // Score-Berechnung (0-100)
  const viewpointScore = Math.min(totalViewpoints * 5, 40); // Max 40 Punkte
  const scenicRoadScore = Math.min(totalScenicRoads * 3, 30); // Max 30 Punkte
  const parkScore = Math.min(totalNaturalParks * 10, 30); // Max 30 Punkte

  const totalScore = viewpointScore + scenicRoadScore + parkScore;
  
  console.log(`🏞️ Scenic Score: ${totalScore}/100 (Viewpoints: ${totalViewpoints}, Roads: ${totalScenicRoads}, Parks: ${totalNaturalParks})`);
  
  return Math.round(totalScore);
}

/**
 * Finde Scenic-Punkte entlang einer Route
 */
export async function findScenicAlongRoute(waypoints, maxDistanceKm = 10) {
  const allViewpoints = [];
  const allScenicRoads = [];
  const allNaturalParks = [];
  
  for (const wp of waypoints) {
    const result = await findScenicPoints(wp.lat, wp.lon, maxDistanceKm);
    allViewpoints.push(...result.viewpoints);
    allScenicRoads.push(...result.scenicRoads);
    allNaturalParks.push(...result.naturalParks);
  }
  
  // Dedupliziere basierend auf ID
  const uniqueViewpoints = Array.from(new Map(allViewpoints.map(v => [v.id, v])).values());
  const uniqueScenicRoads = Array.from(new Map(allScenicRoads.map(r => [r.id, r])).values());
  const uniqueNaturalParks = Array.from(new Map(allNaturalParks.map(p => [p.id, p])).values());
  
  return {
    viewpoints: uniqueViewpoints,
    scenicRoads: uniqueScenicRoads,
    naturalParks: uniqueNaturalParks
  };
}
