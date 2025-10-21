// Trip Planner Service - Multi-Day Route Planning
import fetch from 'node-fetch';
import { searchAccommodations } from './accommodation-fetcher.js';
import { optimizeRoute } from './route-optimizer.js';

const OSRM_URL = 'http://router.project-osrm.org/route/v1/driving';

/**
 * Plane Multi-Day Trip von Start zu Ziel
 */
export async function planTrip(startLocation, endLocation, preferences) {
  const {
    maxKmPerDay = 350,
    avgSpeed = 70,
    maxDrivingHours = 6,
    accommodation = {},
    route: routePrefs = {}
  } = preferences;

  try {
    // 1. Berechne optimierte Route
    const totalRoute = preferences.optimize 
      ? await optimizeRoute(startLocation, endLocation, preferences)
      : await calculateRoute(startLocation, endLocation, routePrefs);
    
    if (!totalRoute) {
      throw new Error('Keine Route gefunden');
    }

    // 2. Segmentiere Route in Tagesetappen
    const days = segmentRoute(totalRoute, maxKmPerDay, maxDrivingHours);
    
    // 3. Finde Übernachtungen für jeden Tag
    const daysWithAccommodation = await findAccommodationsForDays(days, accommodation);
    
    // 4. Berechne Gesamt-Statistiken
    const totalDistance = days.reduce((sum, day) => sum + day.distance, 0);
    const totalDuration = days.reduce((sum, day) => sum + day.duration, 0);
    const totalCost = daysWithAccommodation
      .filter(day => day.accommodation)
      .reduce((sum, day) => sum + (day.accommodation.price || 0), 0);
    
    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration * 10) / 10,
      totalDays: days.length,
      totalCost: Math.round(totalCost * 100) / 100,
      days: daysWithAccommodation,
      route: totalRoute
    };
    
  } catch (error) {
    console.error('Trip planning error:', error);
    throw error;
  }
}

/**
 * Berechne Route mit OSRM
 */
/**
 * Klassifiziere Straßentyp basierend auf OSRM Step-Daten
 */
function classifyRoadType(step) {
  const name = (step.name || '').toLowerCase();
  const mode = (step.mode || '').toLowerCase();
  
  // Offroad-Indikatoren
  const offroadKeywords = ['track', 'path', 'trail', 'unpaved', 'dirt', 'gravel'];
  const forestKeywords = ['forest', 'wald', 'forst'];
  
  // Prüfe auf echtes Offroad (Gelände)
  if (offroadKeywords.some(keyword => name.includes(keyword)) || mode === 'track') {
    return 'offroad'; // 🟠 Orange
  }
  
  // Prüfe auf Schotterwege/Forststraßen
  if (forestKeywords.some(keyword => name.includes(keyword)) || 
      name.includes('schotter') || 
      name.includes('kies') ||
      mode === 'path') {
    return 'gravel'; // 🟡 Gelb
  }
  
  // Standard: Asphalt
  return 'paved'; // 🔵 Blau
}

async function calculateRoute(start, end, preferences = {}) {
  const { avoidTolls = true, avoidHighways = false } = preferences;
  
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
    
    // Klassifiziere jeden Step nach Straßentyp
    const stepsWithType = route.legs[0].steps.map(step => ({
      ...step,
      roadType: classifyRoadType(step)
    }));
    
    // Berechne Statistiken
    const totalDistance = route.distance / 1000;
    let pavedKm = 0;
    let gravelKm = 0;
    let offroadKm = 0;
    
    stepsWithType.forEach(step => {
      const stepKm = step.distance / 1000;
      if (step.roadType === 'offroad') offroadKm += stepKm;
      else if (step.roadType === 'gravel') gravelKm += stepKm;
      else pavedKm += stepKm;
    });
    
    return {
      distance: totalDistance,
      duration: route.duration / 3600, // s → h
      geometry: route.geometry,
      legs: route.legs,
      steps: stepsWithType,
      roadStats: {
        paved: { km: pavedKm, percent: (pavedKm / totalDistance * 100).toFixed(1) },
        gravel: { km: gravelKm, percent: (gravelKm / totalDistance * 100).toFixed(1) },
        offroad: { km: offroadKm, percent: (offroadKm / totalDistance * 100).toFixed(1) }
      }
    };
  } catch (error) {
    console.error('OSRM routing error:', error);
    return null;
  }
}

/**
 * Segmentiere Route in Tagesetappen
 */
function segmentRoute(route, maxKmPerDay, maxHours) {
  const days = [];
  let currentDay = {
    dayNumber: 1,
    distance: 0,
    duration: 0,
    segments: [],
    coordinates: []
  };
  
  // Vereinfachte Segmentierung basierend auf Distanz
  const totalDistance = route.distance;
  const estimatedDays = Math.ceil(totalDistance / maxKmPerDay);
  const kmPerDay = totalDistance / estimatedDays;
  
  // Teile Geometry-Koordinaten auf Tage auf
  const coords = route.geometry.coordinates;
  const coordsPerDay = Math.floor(coords.length / estimatedDays);
  
  for (let i = 0; i < estimatedDays; i++) {
    const startIdx = i * coordsPerDay;
    const endIdx = i === estimatedDays - 1 ? coords.length : (i + 1) * coordsPerDay;
    
    const dayCoords = coords.slice(startIdx, endIdx);
    const dayDistance = (totalDistance / estimatedDays);
    const dayDuration = dayDistance / 70; // Annahme: 70 km/h
    
    const startCoord = dayCoords[0];
    const endCoord = dayCoords[dayCoords.length - 1];
    
    days.push({
      dayNumber: i + 1,
      distance: Math.round(dayDistance * 10) / 10,
      duration: Math.round(dayDuration * 10) / 10,
      startLocation: {
        lat: startCoord[1],
        lon: startCoord[0]
      },
      endLocation: {
        lat: endCoord[1],
        lon: endCoord[0]
      },
      coordinates: dayCoords,
      geometry: {
        type: 'LineString',
        coordinates: dayCoords
      }
    });
  }
  
  return days;
}

/**
 * Finde Übernachtungen für alle Tage
 */
async function findAccommodationsForDays(days, preferences) {
  const {
    maxPrice = null,
    freeOnly = false,
    needsElectricity = false,
    needsWater = false,
    needsDisposal = false
  } = preferences;
  
  // PERFORMANCE FIX: Suche alle Stellplätze parallel statt sequentiell
  const accommodationPromises = days.map(async (day, i) => {
    // Letzter Tag braucht keine Übernachtung
    if (i === days.length - 1) {
      return {
        ...day,
        accommodation: null
      };
    }
    
    try {
      // Suche Stellplätze in 30km Radius um Tagesendpunkt
      const accommodations = await searchAccommodations(
        day.endLocation.lat,
        day.endLocation.lon,
        30,
        { maxPrice, freeOnly }
      );
      
      // Filtere nach Features
      let filtered = accommodations;
      
      if (needsElectricity) {
        filtered = filtered.filter(a => a.features?.electricity);
      }
      if (needsWater) {
        filtered = filtered.filter(a => a.features?.water);
      }
      if (needsDisposal) {
        filtered = filtered.filter(a => a.features?.disposal);
      }
      
      // Wähle beste Option (günstigster, beste Bewertung, näheste)
      const bestAccommodation = selectBestAccommodation(filtered, preferences);
      
      return {
        ...day,
        accommodation: bestAccommodation || null
      };
    } catch (error) {
      console.error('Accommodation search error for day', day.dayNumber, error);
      return {
        ...day,
        accommodation: null
      };
    }
  });
  
  // Warte auf alle Suchen gleichzeitig
  return await Promise.all(accommodationPromises);
}

/**
 * Wähle beste Übernachtungsoption
 */
function selectBestAccommodation(accommodations, preferences) {
  if (accommodations.length === 0) return null;
  
  // Sortiere nach: Preis, Bewertung, Distanz
  const sorted = accommodations.sort((a, b) => {
    // Priorität 1: Kostenlos
    if (preferences.freeOnly) {
      if (a.price === 0 && b.price !== 0) return -1;
      if (b.price === 0 && a.price !== 0) return 1;
    }
    
    // Priorität 2: Preis
    const priceA = a.price || 0;
    const priceB = b.price || 0;
    if (priceA !== priceB) return priceA - priceB;
    
    // Priorität 3: Bewertung
    const ratingA = a.rating || 0;
    const ratingB = b.rating || 0;
    if (ratingA !== ratingB) return ratingB - ratingA;
    
    // Priorität 4: Distanz
    return a.distance - b.distance;
  });
  
  return sorted[0];
}

/**
 * Berechne Umweg zu Stellplatz
 */
export async function calculateDetour(currentEndpoint, accommodation) {
  const route = await calculateRoute(
    currentEndpoint,
    { lat: accommodation.lat, lon: accommodation.lon },
    {}
  );
  
  return {
    distance: route?.distance || 0,
    duration: route?.duration || 0
  };
}
