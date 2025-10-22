// Germany Scenic Finder - Fast queries using pre-calculated data
import pool from '../database/db-postgres.js';

/**
 * Finde Scenic-Punkte in Deutschland (schnell, ohne Overpass API)
 */
export async function findGermanyScenicPoints(lat, lon, radiusKm = 50) {
  try {
    const result = await pool.query(
      `SELECT * FROM find_scenic_points_near($1, $2, $3)`,
      [lat, lon, radiusKm]
    );
    
    if (result.rows.length === 0) {
      return { viewpoints: [], scenicRoads: [], naturalParks: [], cached: true, source: 'germany_database' };
    }
    
    const row = result.rows[0];
    
    return {
      viewpoints: row.viewpoints || [],
      scenicRoads: row.scenic_roads || [],
      naturalParks: row.parks || [],
      cached: true,
      source: 'germany_database'
    };
  } catch (error) {
    console.error('Germany scenic finder error:', error);
    return { viewpoints: [], scenicRoads: [], naturalParks: [], cached: false };
  }
}

/**
 * Berechne Scenic-Score für Route in Deutschland
 */
export async function calculateGermanyScenicScore(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;

  let totalViewpoints = 0;
  let totalScenicRoads = 0;
  let totalNaturalParks = 0;

  // Für jeden Waypoint: Suche Scenic-Punkte (PARALLEL)
  const promises = waypoints.map(wp => findGermanyScenicPoints(wp.lat, wp.lon, 25));
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    totalViewpoints += result.viewpoints.length;
    totalScenicRoads += result.scenicRoads.length;
    totalNaturalParks += result.naturalParks.length;
  });

  // Score-Berechnung (0-100)
  const viewpointScore = Math.min(totalViewpoints * 5, 40); // Max 40 Punkte
  const scenicRoadScore = Math.min(totalScenicRoads * 3, 30); // Max 30 Punkte
  const parkScore = Math.min(totalNaturalParks * 10, 30); // Max 30 Punkte

  const totalScore = viewpointScore + scenicRoadScore + parkScore;
  
  return Math.round(totalScore);
}

/**
 * Finde Scenic-Punkte entlang einer Route in Deutschland
 */
export async function findGermanyScenicAlongRoute(waypoints, maxDistanceKm = 10) {
  const allViewpoints = [];
  const allScenicRoads = [];
  const allNaturalParks = [];
  
  // PARALLEL für Performance
  const promises = waypoints.map(wp => findGermanyScenicPoints(wp.lat, wp.lon, maxDistanceKm));
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    allViewpoints.push(...result.viewpoints);
    allScenicRoads.push(...result.scenicRoads);
    allNaturalParks.push(...result.naturalParks);
  });
  
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

/**
 * Check if coordinates are in Germany (approximate bounding box)
 */
export function isInGermany(lat, lon) {
  return lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1;
}
