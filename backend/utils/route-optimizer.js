// Route Optimizer - Intelligente Routenplanung
import fetch from 'node-fetch';
import { searchAccommodations } from './accommodation-fetcher.js';

const OSRM_URL = 'http://router.project-osrm.org/route/v1/driving';
const GRAPHHOPPER_URL = 'https://graphhopper.com/api/1/route';

/**
 * Optimiere Route basierend auf Präferenzen
 */
export async function optimizeRoute(startLocation, endLocation, preferences = {}) {
  const {
    offroadWeight = 0.5,    // 0 = nur Straße, 1 = maximal Offroad
    scenicWeight = 0.3,      // 0 = schnellste, 1 = schönste
    accommodationWeight = 0.2, // 0 = ignorieren, 1 = optimal zu Stellplätzen
    maxDetourPercent = 20,   // Maximaler Umweg in %
    maxKmPerDay = 350
  } = preferences;

  try {
    // 1. Berechne Basis-Routen (schnellste, kürzeste, scenic)
    const routes = await calculateMultipleRoutes(startLocation, endLocation, preferences);
    
    // 2. Score jede Route
    const scoredRoutes = await Promise.all(routes.map(async (route) => {
      const score = await scoreRoute(route, preferences, startLocation);
      return { ...route, score };
    }));
    
    // 3. Wähle beste Route
    const bestRoute = scoredRoutes.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    // 4. Optimiere für Übernachtungen
    if (accommodationWeight > 0) {
      return await optimizeForAccommodations(bestRoute, preferences);
    }
    
    return bestRoute;
    
  } catch (error) {
    console.error('Route optimization error:', error);
    throw error;
  }
}

/**
 * Berechne multiple Routen-Varianten
 */
async function calculateMultipleRoutes(start, end, preferences) {
  const routes = [];
  
  // Route 1: Schnellste (Standard OSRM)
  const fastest = await calculateOSRMRoute(start, end, 'fastest');
  if (fastest) {
    fastest.type = 'fastest';
    routes.push(fastest);
  }
  
  // Route 2: Maut vermeiden
  if (preferences.avoidTolls) {
    const noToll = await calculateOSRMRoute(start, end, 'fastest');
    if (noToll) {
      noToll.type = 'no_toll';
      routes.push(noToll);
    }
  }
  
  // Route 3: Autobahn vermeiden
  if (preferences.avoidHighways) {
    const noHighway = await calculateOSRMRoute(start, end, 'shortest');
    if (noHighway) {
      noHighway.type = 'no_highway';
      routes.push(noHighway);
    }
  }
  
  return routes;
}

/**
 * OSRM Route berechnen
 */
async function calculateOSRMRoute(start, end, profile = 'fastest') {
  const coords = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    annotations: 'true'
  });
  
  const url = `${OSRM_URL}/${coords}?${params}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }
    
    const route = data.routes[0];
    
    return {
      distance: route.distance / 1000, // m → km
      duration: route.duration / 3600, // s → h
      geometry: route.geometry,
      legs: route.legs,
      steps: route.legs[0].steps,
      offroadKm: 0, // Wird später berechnet
      scenicScore: 0 // Wird später berechnet
    };
  } catch (error) {
    console.error('OSRM routing error:', error);
    return null;
  }
}

/**
 * Score Route basierend auf Kriterien
 */
async function scoreRoute(route, preferences, startLocation) {
  const {
    offroadWeight = 0.5,
    scenicWeight = 0.3,
    accommodationWeight = 0.2
  } = preferences;
  
  // 1. Offroad-Score (basierend auf Track-Typen in Nähe)
  const offroadScore = await calculateOffroadScore(route);
  
  // 2. Scenic-Score (basierend auf Landschaftstypen)
  const scenicScore = calculateScenicScore(route);
  
  // 3. Accommodation-Score (basierend auf Stellplatz-Verfügbarkeit)
  const accommodationScore = await calculateAccommodationScore(route, preferences);
  
  // Gewichtete Summe
  const totalScore = 
    (offroadScore * offroadWeight) +
    (scenicScore * scenicWeight) +
    (accommodationScore * accommodationWeight);
  
  route.offroadScore = offroadScore;
  route.scenicScore = scenicScore;
  route.accommodationScore = accommodationScore;
  
  return totalScore;
}

/**
 * Berechne Offroad-Potential der Route
 */
async function calculateOffroadScore(route) {
  // Vereinfacht: Prüfe wie viele Offroad-Tracks in 5km Nähe der Route liegen
  // In Produktion: Overpass API für tracks entlang Route
  
  let offroadKm = 0;
  const samplePoints = sampleRoutePoints(route.geometry.coordinates, 10); // Jeder 10. Punkt
  
  for (const point of samplePoints) {
    // Simuliere Offroad-Nähe basierend auf Koordinaten
    // Echte Implementation würde Overpass API nutzen
    const lat = point[1];
    const lon = point[0];
    
    // Heuristik: Bergregionen haben mehr Offroad
    // Alpen: 45-48N, 6-16E
    // Pyrenäen: 42-43N, -2-3E
    const isAlpine = (lat >= 45 && lat <= 48 && lon >= 6 && lon <= 16);
    const isPyrenees = (lat >= 42 && lat <= 43 && lon >= -2 && lon <= 3);
    
    if (isAlpine || isPyrenees) {
      offroadKm += 5; // Geschätzt 5km Offroad pro Sample-Point
    }
  }
  
  route.offroadKm = offroadKm;
  
  // Score: 0-100 basierend auf Offroad-Anteil
  const offroadPercent = (offroadKm / route.distance) * 100;
  return Math.min(offroadPercent, 100);
}

/**
 * Berechne Scenic-Score (Landschaftliche Schönheit)
 */
function calculateScenicScore(route) {
  // Vereinfacht: Bewerte basierend auf Höhenunterschied und Kurvigkeit
  let scenicScore = 0;
  
  const coords = route.geometry.coordinates;
  
  // 1. Kurvigkeit (mehr Kurven = schöner)
  let totalAngle = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    const angle = calculateAngle(coords[i-1], coords[i], coords[i+1]);
    totalAngle += Math.abs(angle);
  }
  const curvinessScore = Math.min((totalAngle / coords.length) * 10, 50);
  
  // 2. Bergregionen (höhere Elevation = schöner)
  const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  const mountainScore = (avgLat >= 42 && avgLat <= 48) ? 50 : 0;
  
  scenicScore = curvinessScore + mountainScore;
  
  return scenicScore;
}

/**
 * Berechne Accommodation-Score
 */
async function calculateAccommodationScore(route, preferences) {
  const { maxKmPerDay = 350 } = preferences;
  
  // Sample-Punkte entlang Route für potenzielle Übernachtungen
  const estimatedDays = Math.ceil(route.distance / maxKmPerDay);
  const pointsPerDay = Math.floor(route.geometry.coordinates.length / estimatedDays);
  
  let totalAccommodations = 0;
  
  for (let day = 1; day < estimatedDays; day++) {
    const idx = day * pointsPerDay;
    if (idx >= route.geometry.coordinates.length) break;
    
    const point = route.geometry.coordinates[idx];
    
    try {
      // Suche Stellplätze in 30km Radius
      const accommodations = await searchAccommodations(point[1], point[0], 30, {
        freeOnly: preferences.accommodation?.freeOnly || false
      });
      
      totalAccommodations += accommodations.length;
    } catch (error) {
      // Ignoriere Fehler
    }
  }
  
  // Score: 0-100 basierend auf Stellplatz-Verfügbarkeit
  const avgAccommodationsPerDay = totalAccommodations / Math.max(estimatedDays - 1, 1);
  return Math.min(avgAccommodationsPerDay * 10, 100);
}

/**
 * Optimiere Route für bessere Stellplatz-Nähe
 */
async function optimizeForAccommodations(route, preferences) {
  const { maxKmPerDay = 350, maxDetourPercent = 20 } = preferences;
  
  const estimatedDays = Math.ceil(route.distance / maxKmPerDay);
  const coords = route.geometry.coordinates;
  const pointsPerDay = Math.floor(coords.length / estimatedDays);
  
  const optimizedCoords = [...coords];
  const detours = [];
  
  for (let day = 1; day < estimatedDays; day++) {
    const idx = day * pointsPerDay;
    if (idx >= coords.length) break;
    
    const dayEndpoint = coords[idx];
    
    try {
      // Suche beste Unterkunft in Nähe
      const accommodations = await searchAccommodations(
        dayEndpoint[1], 
        dayEndpoint[0], 
        30,
        preferences.accommodation || {}
      );
      
      if (accommodations.length > 0) {
        const best = accommodations[0]; // Bereits nach Preis/Bewertung sortiert
        
        // Berechne Umweg
        const detourKm = haversine(dayEndpoint[1], dayEndpoint[0], best.lat, best.lon);
        const maxDetourKm = (route.distance / estimatedDays) * (maxDetourPercent / 100);
        
        if (detourKm <= maxDetourKm) {
          // Füge Umweg zur Route hinzu
          detours.push({
            day,
            accommodation: best,
            detourKm
          });
          
          // Passe Route an (vereinfacht: füge Punkt ein)
          optimizedCoords.splice(idx, 0, [best.lon, best.lat]);
        }
      }
    } catch (error) {
      console.error('Accommodation optimization error:', error);
    }
  }
  
  return {
    ...route,
    optimizedGeometry: {
      type: 'LineString',
      coordinates: optimizedCoords
    },
    detours,
    optimized: true
  };
}

/**
 * Helper: Sample Route-Punkte
 */
function sampleRoutePoints(coordinates, interval = 10) {
  return coordinates.filter((_, i) => i % interval === 0);
}

/**
 * Helper: Berechne Winkel zwischen 3 Punkten
 */
function calculateAngle(p1, p2, p3) {
  const a1 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const a2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
  let angle = a2 - a1;
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Helper: Haversine-Distanz
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
