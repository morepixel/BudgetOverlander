// Routes API - Routen berechnen und speichern
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { generateGPX, generateSimpleGPX } from '../utils/gpx-export.js';
import { calculateToll, calculateTollFreeAlternative } from '../utils/toll-calculator.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

// Haversine-Distanz
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

// OSRM Route abrufen
async function getRoute(fromLat, fromLon, toLat, toLon) {
  const url = `${OSRM_ENDPOINT}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM Error: ${response.status}`);
    
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Keine Route gefunden');
    }
    
    const route = data.routes[0];
    return {
      distance: route.distance / 1000,
      duration: route.duration / 60,
      geometry: route.geometry
    };
  } catch (error) {
    console.error('OSRM error:', error);
    const airDistance = haversine(fromLat, fromLon, toLat, toLon);
    return {
      distance: airDistance * 1.3,
      duration: (airDistance * 1.3 / 70) * 60,
      geometry: {
        type: "LineString",
        coordinates: [[fromLon, fromLat], [toLon, toLat]]
      },
      fallback: true
    };
  }
}

// Budget berechnen
function calculateBudget(offroadKm, onroadKm, difficulty, fuelPrice = 1.65) {
  const baseConsumption = 12;
  const offroadFactor = difficulty <= 40 ? 1.3 : difficulty <= 60 ? 1.5 : 1.7;
  
  const offroadFuel = (offroadKm / 100) * baseConsumption * offroadFactor;
  const onroadFuel = (onroadKm / 100) * baseConsumption;
  const totalFuel = offroadFuel + onroadFuel;
  const fuelCost = totalFuel * fuelPrice;
  
  const offroadSpeed = difficulty <= 40 ? 35 : difficulty <= 60 ? 25 : 18;
  const onroadSpeed = 70;
  const offroadTime = offroadKm / offroadSpeed;
  const onroadTime = onroadKm / onroadSpeed;
  const totalTime = offroadTime + onroadTime;
  
  return {
    fuel: { offroad: offroadFuel, onroad: onroadFuel, total: totalFuel },
    cost: { fuel: fuelCost, camping: 15, food: 25, total: fuelCost + 40 },
    time: { offroad: offroadTime, onroad: onroadTime, total: totalTime }
  };
}

// POST /api/routes/calculate - Route berechnen
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { regionId, clusterIds, maxOffroadPerDay = 80 } = req.body;
    
    if (!regionId || !clusterIds || clusterIds.length === 0) {
      return res.status(400).json({ error: 'regionId und clusterIds erforderlich' });
    }
    
    // Lade Region-Daten
    const dataFiles = fs.readdirSync(join(__dirname, '..', '..'))
      .filter(f => f.startsWith(`region-${regionId}-`) && f.endsWith('.json'));
    
    if (dataFiles.length === 0) {
      return res.status(404).json({ error: 'Region-Daten nicht gefunden' });
    }
    
    const dataPath = join(__dirname, '..', '..', dataFiles[0]);
    const regionData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Finde ausgewählte Cluster
    const selectedClusters = regionData.clusters.filter(c => clusterIds.includes(c.id));
    
    if (selectedClusters.length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Cluster gefunden' });
    }
    
    // Berechne Route
    const route = [];
    const routeGeometries = [];
    let totalOffroadKm = 0;
    let totalOnroadKm = 0;
    
    for (let i = 0; i < selectedClusters.length; i++) {
      const cluster = selectedClusters[i];
      const nextCluster = selectedClusters[i + 1];
      
      const availableOffroad = Math.min(cluster.totalLength, maxOffroadPerDay);
      
      let connectionKm = 0;
      let connectionGeometry = null;
      
      if (nextCluster) {
        const osrmRoute = await getRoute(
          cluster.center.lat, cluster.center.lon,
          nextCluster.center.lat, nextCluster.center.lon
        );
        connectionKm = osrmRoute.distance;
        connectionGeometry = osrmRoute.geometry;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const budget = calculateBudget(availableOffroad, connectionKm, cluster.avgDifficulty);
      
      const day = {
        day: i + 1,
        cluster: cluster.id,
        center: cluster.center,
        nearestTown: cluster.nearestTown,
        offroad: {
          available: cluster.totalLength,
          planned: availableOffroad,
          tracks: cluster.trackCount
        },
        connection: {
          toNext: nextCluster ? nextCluster.id : null,
          distance: connectionKm
        },
        total: {
          offroad: availableOffroad,
          onroad: connectionKm,
          distance: availableOffroad + connectionKm,
          offroadPercentage: ((availableOffroad / (availableOffroad + connectionKm)) * 100)
        },
        difficulty: cluster.avgDifficulty,
        budget: budget
      };
      
      route.push(day);
      
      if (connectionGeometry) {
        routeGeometries.push({
          day: i + 1,
          from: cluster.id,
          to: nextCluster.id,
          geometry: connectionGeometry
        });
      }
      
      totalOffroadKm += availableOffroad;
      totalOnroadKm += connectionKm;
    }
    
    const totalDistance = totalOffroadKm + totalOnroadKm;
    const totalCost = route.reduce((sum, d) => sum + d.budget.cost.total, 0);
    const totalTime = route.reduce((sum, d) => sum + d.budget.time.total, 0);
    
    // GeoJSON erstellen
    const geojson = {
      type: "FeatureCollection",
      features: [
        ...route.map((day, idx) => ({
          type: "Feature",
          properties: {
            day: day.day,
            cluster: day.cluster,
            location: day.nearestTown,
            offroad: `${day.offroad.planned.toFixed(1)} km`,
            difficulty: `${day.difficulty}/100`,
            budget: `${day.budget.cost.total.toFixed(2)}€`,
            "marker-color": ["#2ecc71", "#3498db", "#9b59b6", "#e74c3c", "#f39c12", "#1abc9c", "#e67e22"][idx] || "#95a5a6",
            "marker-size": "large",
            "marker-symbol": day.day.toString()
          },
          geometry: {
            type: "Point",
            coordinates: [day.center.lon, day.center.lat]
          }
        })),
        ...routeGeometries.map(rg => ({
          type: "Feature",
          properties: {
            day: rg.day,
            from: rg.from,
            to: rg.to,
            stroke: "#e74c3c",
            "stroke-width": 3,
            "stroke-opacity": 0.7
          },
          geometry: rg.geometry
        }))
      ]
    };
    
    // Berechne Maut
    const vehiclesResult = await pool.query('SELECT * FROM vehicles WHERE user_id = $1', [req.user.userId]);
    const vehicles = vehiclesResult.rows;
    let vehicle = vehicles.find(v => v.is_default) || vehicles[0];
    const vehicleWeight = vehicle?.weight || 7.5;
    
    const tollData = calculateToll({
      region: regionId,
      onroadKm: totalOnroadKm,
      offroadKm: totalOffroadKm
    }, vehicleWeight);
    
    const tollFreeAlt = calculateTollFreeAlternative({
      region: regionId,
      onroadKm: totalOnroadKm,
      offroadKm: totalOffroadKm
    });
    
    res.json({
      region: regionData.region,
      days: route,
      summary: {
        totalDays: route.length,
        totalDistance: totalDistance,
        offroadKm: totalOffroadKm,
        onroadKm: totalOnroadKm,
        offroadPercentage: (totalOffroadKm / totalDistance * 100),
        avgDifficulty: route.reduce((sum, d) => sum + d.difficulty, 0) / route.length,
        totalCost: totalCost,
        totalTime: totalTime,
        toll: tollData,
        tollFreeAlternative: tollFreeAlt
      },
      geojson: geojson
    });
  } catch (error) {
    console.error('Calculate route error:', error);
    res.status(500).json({ error: 'Fehler bei Routen-Berechnung' });
  }
});

// GET /api/routes/saved - Gespeicherte Routen des Users
router.get('/saved', authenticateToken, (req, res) => {
  try {
    const routes = db.prepare(
      'SELECT id, name, region, created_at FROM saved_routes WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.userId);
    
    res.json({ routes });
  } catch (error) {
    console.error('Get saved routes error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Routen' });
  }
});

// POST /api/routes/save - Route speichern
router.post('/save', authenticateToken, (req, res) => {
  try {
    const { name, region, clusterIds, routeData } = req.body;
    
    if (!name || !region || !clusterIds || !routeData) {
      return res.status(400).json({ error: 'Alle Felder erforderlich' });
    }
    
    const result = db.prepare(
      'INSERT INTO saved_routes (user_id, name, region, cluster_ids, route_data) VALUES (?, ?, ?, ?, ?)'
    ).run(
      req.user.userId,
      name,
      region,
      JSON.stringify(clusterIds),
      JSON.stringify(routeData)
    );
    
    res.status(201).json({
      message: 'Route gespeichert',
      routeId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Save route error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// GET /api/routes/saved/:id - Einzelne gespeicherte Route
router.get('/saved/:id', authenticateToken, (req, res) => {
  try {
    const route = db.prepare(
      'SELECT * FROM saved_routes WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.userId);
    
    if (!route) {
      return res.status(404).json({ error: 'Route nicht gefunden' });
    }
    
    res.json({
      ...route,
      cluster_ids: JSON.parse(route.cluster_ids),
      route_data: JSON.parse(route.route_data)
    });
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// DELETE /api/routes/saved/:id - Route löschen
router.delete('/saved/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM saved_routes WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Route nicht gefunden' });
    }
    
    res.json({ message: 'Route gelöscht' });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /api/routes/budget-radar - Budget-basierte Routenvorschläge
router.post('/budget-radar', authenticateToken, async (req, res) => {
  try {
    const { budget, radius, startPoint, days, regionId } = req.body;
    
    if (!budget || !radius || !startPoint || !days) {
      return res.status(400).json({ error: 'Budget, Radius, Startpunkt und Tage erforderlich' });
    }

    // Hole User's Standard-Fahrzeug
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE user_id = ?').all(req.user.userId);
    let vehicle = vehicles.find(v => v.is_default);
    
    if (!vehicle && vehicles.length > 0) {
      vehicle = vehicles[0];
    } else if (!vehicle) {
      // Default FUSO
      vehicle = {
        fuel_consumption_onroad: 12,
        fuel_consumption_offroad: 18
      };
    }

    // Lade Region-Daten
    const dataFiles = fs.readdirSync(join(__dirname, '..', '..'))
      .filter(f => f.startsWith(`region-${regionId || 'pyrenees'}-`) && f.endsWith('.json'));
    
    if (dataFiles.length === 0) {
      return res.status(404).json({ error: 'Region-Daten nicht gefunden' });
    }
    
    const dataPath = join(__dirname, '..', '..', dataFiles[0]);
    const regionData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Filtere Cluster im Radius (vereinfacht: Luftlinie)
    const startCoords = startPoint.split(',').map(c => parseFloat(c.trim()));
    const [startLat, startLon] = startCoords;

    const clustersInRadius = regionData.clusters.filter(cluster => {
      const distance = haversine(startLat, startLon, cluster.center.lat, cluster.center.lon);
      return distance <= radius;
    }).sort((a, b) => {
      const distA = haversine(startLat, startLon, a.center.lat, a.center.lon);
      const distB = haversine(startLat, startLon, b.center.lat, b.center.lon);
      return distA - distB;
    });

    if (clustersInRadius.length === 0) {
      return res.json({
        message: 'Keine Cluster im angegebenen Radius gefunden',
        suggestions: []
      });
    }

    // Erstelle 3-5 Routenvorschläge mit unterschiedlichen Schwerpunkten
    const suggestions = [];

    // Vorschlag 1: Maximales Offroad (schwierigste Tracks)
    const offroadMax = await generateRouteSuggestion(
      clustersInRadius,
      days,
      budget,
      vehicle,
      'offroad-max',
      startLat,
      startLon
    );
    if (offroadMax) suggestions.push(offroadMax);

    // Vorschlag 2: Balanced (Mix aus Offroad & Komfort)
    const balanced = await generateRouteSuggestion(
      clustersInRadius,
      days,
      budget,
      vehicle,
      'balanced',
      startLat,
      startLon
    );
    if (balanced) suggestions.push(balanced);

    // Vorschlag 3: Budget-optimiert (günstigste Route)
    const budgetOpt = await generateRouteSuggestion(
      clustersInRadius,
      days,
      budget,
      vehicle,
      'budget',
      startLat,
      startLon
    );
    if (budgetOpt) suggestions.push(budgetOpt);

    res.json({
      message: `${suggestions.length} Routenvorschläge gefunden`,
      budget: budget,
      radius: radius,
      days: days,
      clustersAvailable: clustersInRadius.length,
      suggestions: suggestions
    });

  } catch (error) {
    console.error('Budget radar error:', error);
    res.status(500).json({ error: 'Fehler bei Budget-Radar' });
  }
});

// Helper: Generiere Routenvorschlag
async function generateRouteSuggestion(clusters, days, budget, vehicle, type, startLat, startLon) {
  let selectedClusters = [];
  
  // Strategie basierend auf Typ
  if (type === 'offroad-max') {
    // Wähle Cluster mit höchster Schwierigkeit
    selectedClusters = clusters
      .sort((a, b) => b.avgDifficulty - a.avgDifficulty)
      .slice(0, Math.min(days, clusters.length));
  } else if (type === 'balanced') {
    // Wähle Mix aus nah & interessant
    selectedClusters = clusters
      .sort((a, b) => {
        const distA = haversine(startLat, startLon, a.center.lat, a.center.lon);
        const distB = haversine(startLat, startLon, b.center.lat, b.center.lon);
        return (distA + (100 - a.avgDifficulty)) - (distB + (100 - b.avgDifficulty));
      })
      .slice(0, Math.min(days, clusters.length));
  } else if (type === 'budget') {
    // Wähle nächste Cluster (minimale Distanz)
    selectedClusters = clusters.slice(0, Math.min(days, clusters.length));
  }

  if (selectedClusters.length === 0) return null;

  // Berechne grobe Kosten
  let totalOffroadKm = 0;
  let totalOnroadKm = 0;

  for (let i = 0; i < selectedClusters.length; i++) {
    const cluster = selectedClusters[i];
    totalOffroadKm += Math.min(cluster.totalLength, 80); // Max 80km Offroad/Tag

    if (i < selectedClusters.length - 1) {
      const nextCluster = selectedClusters[i + 1];
      const distance = haversine(
        cluster.center.lat, cluster.center.lon,
        nextCluster.center.lat, nextCluster.center.lon
      );
      totalOnroadKm += distance * 1.3; // Straßenfaktor
    }
  }

  // Budget-Berechnung
  const fuelOnroad = (totalOnroadKm / 100) * vehicle.fuel_consumption_onroad;
  const fuelOffroad = (totalOffroadKm / 100) * vehicle.fuel_consumption_offroad;
  const totalFuel = fuelOnroad + fuelOffroad;
  const fuelCost = totalFuel * 1.65; // €/L
  const campingCost = days * 15;
  const foodCost = days * 25;
  const totalCost = fuelCost + campingCost + foodCost;

  // Prüfe ob im Budget
  if (totalCost > budget) {
    return null; // Zu teuer
  }

  return {
    type: type,
    name: type === 'offroad-max' ? 'Maximales Offroad-Abenteuer' :
          type === 'balanced' ? 'Ausgewogene Tour' :
          'Budget-freundliche Route',
    description: type === 'offroad-max' ? 'Schwierigste Tracks, maximales Abenteuer' :
                 type === 'balanced' ? 'Mix aus Offroad & Komfort' :
                 'Günstigste Route, kurze Distanzen',
    clusters: selectedClusters.map(c => c.id),
    stats: {
      days: days,
      totalDistance: (totalOffroadKm + totalOnroadKm).toFixed(1),
      offroadKm: totalOffroadKm.toFixed(1),
      onroadKm: totalOnroadKm.toFixed(1),
      offroadPercentage: ((totalOffroadKm / (totalOffroadKm + totalOnroadKm)) * 100).toFixed(0),
      avgDifficulty: Math.round(selectedClusters.reduce((sum, c) => sum + c.avgDifficulty, 0) / selectedClusters.length)
    },
    cost: {
      fuel: fuelCost.toFixed(2),
      camping: campingCost,
      food: foodCost,
      total: totalCost.toFixed(2),
      remaining: (budget - totalCost).toFixed(2)
    }
  };
}

// GET /api/routes/export/:routeId/gpx - Route als GPX exportieren
router.get('/export/:routeId/gpx', authenticateToken, (req, res) => {
  try {
    const routeId = parseInt(req.params.routeId);
    
    const route = db.prepare('SELECT * FROM saved_routes WHERE id = ? AND user_id = ?')
      .get(routeId, req.user.userId);
    
    if (!route) {
      return res.status(404).json({ error: 'Route nicht gefunden' });
    }
    
    const routeData = JSON.parse(route.route_data);
    
    const gpx = generateGPX(routeData, {
      name: route.name,
      description: `${route.region} - ${routeData.summary.totalDays} Tage, ${routeData.summary.totalDistance.toFixed(1)}km`,
      author: 'Budget Overlander'
    });
    
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${route.name.replace(/[^a-z0-9]/gi, '_')}.gpx"`);
    res.send(gpx);
    
  } catch (error) {
    console.error('GPX export error:', error);
    res.status(500).json({ error: 'Fehler beim GPX-Export' });
  }
});

// POST /api/routes/export/gpx - Aktuelle Route als GPX exportieren (ohne Speichern)
router.post('/export/gpx', authenticateToken, (req, res) => {
  try {
    const { routeData, name, region } = req.body;
    
    if (!routeData) {
      return res.status(400).json({ error: 'Route-Daten erforderlich' });
    }
    
    const gpx = generateGPX(routeData, {
      name: name || 'Budget Overlander Route',
      description: `${region || 'Unbekannte Region'} - ${routeData.summary?.totalDays || 0} Tage`,
      author: 'Budget Overlander'
    });
    
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${(name || 'route').replace(/[^a-z0-9]/gi, '_')}.gpx"`);
    res.send(gpx);
    
  } catch (error) {
    console.error('GPX export error:', error);
    res.status(500).json({ error: 'Fehler beim GPX-Export' });
  }
});

export default router;
