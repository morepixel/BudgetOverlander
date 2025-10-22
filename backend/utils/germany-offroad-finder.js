// Germany Offroad Finder - Fast queries using pre-calculated data
import pool from '../database/db-postgres.js';

/**
 * Finde Offroad-Tracks in Deutschland (schnell, ohne Overpass API)
 */
export async function findGermanyOffroadTracks(lat, lon, radiusKm = 50) {
  try {
    const result = await pool.query(
      `SELECT * FROM find_offroad_tracks_near($1, $2, $3)`,
      [lat, lon, radiusKm]
    );
    
    const tracks = result.rows;
    const totalKm = tracks.reduce((sum, t) => sum + parseFloat(t.length_km), 0);
    const avgDifficulty = tracks.length > 0 
      ? Math.round(tracks.reduce((sum, t) => sum + t.difficulty, 0) / tracks.length)
      : 0;
    
    return {
      tracks: tracks.map(t => ({
        id: t.osm_id,
        name: t.name,
        highway: t.highway,
        surface: t.surface,
        difficulty: t.difficulty,
        lengthKm: parseFloat(t.length_km)
      })),
      totalKm,
      avgDifficulty,
      cached: true,
      source: 'germany_database'
    };
  } catch (error) {
    console.error('Germany offroad finder error:', error);
    return { tracks: [], totalKm: 0, avgDifficulty: 0, cached: false };
  }
}

/**
 * Berechne Offroad-Prozent für Route in Deutschland
 */
export async function calculateGermanyOffroadPercentage(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;

  let totalAvailableKm = 0;
  let totalRouteLength = 0;

  // Berechne Gesamt-Routenlänge
  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];
    totalRouteLength += haversineDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
  }

  // Für jeden Waypoint: Suche Offroad-Tracks
  for (const wp of waypoints) {
    const result = await findGermanyOffroadTracks(wp.lat, wp.lon, 25);
    totalAvailableKm += result.totalKm;
  }

  // Berechne Prozentsatz
  if (totalRouteLength === 0) return 0;
  const percentage = Math.min((totalAvailableKm / totalRouteLength) * 100, 100);
  
  return Math.round(percentage);
}

/**
 * Haversine distance in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if coordinates are in Germany (approximate bounding box)
 */
export function isInGermany(lat, lon) {
  return lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1;
}
