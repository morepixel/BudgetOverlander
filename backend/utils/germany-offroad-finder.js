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
 * Gibt realistischen Wert zurück: 0% wenn keine Tracks, sonst basierend auf Dichte
 */
export async function calculateGermanyOffroadPercentage(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;

  // Zähle Tracks in größerem Radius um die gesamte Route
  let totalTracks = 0;
  let totalTrackKm = 0;
  let totalRouteLength = 0;

  // Berechne Gesamt-Routenlänge
  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];
    totalRouteLength += haversineDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
  }

  // Prüfe jeden Waypoint auf Offroad-Tracks in 10km Radius (PARALLEL)
  const promises = waypoints.map(wp => findGermanyOffroadTracks(wp.lat, wp.lon, 10));
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    totalTracks += result.tracks.length;
    totalTrackKm += result.totalKm;
  });

  // Berechne realistische Offroad-Prozente basierend auf Track-Dichte
  // Wenn wenig Tracks vorhanden: niedriger Prozentsatz
  // Formel: (Tracks pro Waypoint × durchschnittliche Track-Länge) / Routenlänge
  const avgTracksPerWaypoint = totalTracks / waypoints.length;
  const avgTrackLength = totalTracks > 0 ? totalTrackKm / totalTracks : 0;
  
  // Sehr konservative Schätzung: Nur wenn viele Tracks vorhanden
  let percentage = 0;
  if (avgTracksPerWaypoint > 50) {
    // Viele Tracks = potentiell Offroad-Region
    percentage = Math.min((avgTracksPerWaypoint / 100) * 15, 15); // Max 15%
  } else if (avgTracksPerWaypoint > 20) {
    // Moderate Tracks = etwas Offroad
    percentage = Math.min((avgTracksPerWaypoint / 50) * 8, 8); // Max 8%
  } else {
    // Wenige Tracks = fast kein Offroad
    percentage = Math.min((avgTracksPerWaypoint / 20) * 3, 3); // Max 3%
  }
  
  console.log(`🔍 Offroad Debug: ${totalTracks} tracks, ${avgTracksPerWaypoint.toFixed(1)} avg/wp → ${percentage.toFixed(1)}%`);
  
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
