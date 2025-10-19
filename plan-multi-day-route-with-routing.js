// Multi-Day-Route mit echter Routing-Engine (OSRM)
// Berechnet echte Straßenrouten zwischen Clustern

import fs from "node:fs";

// OSRM Demo API (kostenlos, aber mit Rate-Limits)
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

// Hole echte Route von OSRM
async function getRoute(fromLat, fromLon, toLat, toLon) {
  const url = `${OSRM_ENDPOINT}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=false`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Keine Route gefunden');
    }
    
    const route = data.routes[0];
    return {
      distance: route.distance / 1000, // Meter → km
      duration: route.duration / 60, // Sekunden → Minuten
      geometry: route.geometry // GeoJSON LineString
    };
  } catch (error) {
    console.warn(`⚠️  OSRM Fehler: ${error.message} - nutze Luftlinie`);
    // Fallback: Luftlinie * 1.3
    const airDistance = haversine(fromLat, fromLon, toLat, toLon);
    return {
      distance: airDistance * 1.3,
      duration: (airDistance * 1.3 / 70) * 60, // 70 km/h Durchschnitt
      geometry: {
        type: "LineString",
        coordinates: [[fromLon, fromLat], [toLon, toLat]]
      },
      fallback: true
    };
  }
}

// Berechne Budget
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
    fuel: {
      offroad: offroadFuel.toFixed(1),
      onroad: onroadFuel.toFixed(1),
      total: totalFuel.toFixed(1)
    },
    cost: {
      fuel: fuelCost.toFixed(2),
      camping: 15,
      food: 25,
      total: (fuelCost + 15 + 25).toFixed(2)
    },
    time: {
      offroad: offroadTime.toFixed(1),
      onroad: onroadTime.toFixed(1),
      total: totalTime.toFixed(1),
      totalMinutes: Math.round(totalTime * 60)
    }
  };
}

// Plane Route mit OSRM
async function planRouteWithRouting(clusterData, selectedClusterIds, config = {}) {
  const {
    maxOffroadPerDay = 80,
    targetOffroadPercentage = 60,
  } = config;

  const selectedClusters = clusterData.clusters.filter(c => 
    selectedClusterIds.includes(c.id)
  );

  if (selectedClusters.length === 0) {
    console.error("❌ Keine Cluster ausgewählt!");
    return null;
  }

  console.log("\n" + "=".repeat(80));
  console.log("🗺️  MULTI-DAY ROUTEN-PLANUNG (mit OSRM Routing)");
  console.log("=".repeat(80));
  console.log(`\n📍 Region: ${clusterData.region}`);
  console.log(`📊 Ausgewählte Cluster: ${selectedClusters.length}`);
  console.log(`🎯 Ziel: ${targetOffroadPercentage}% Offroad`);
  console.log(`🚗 Berechne echte Straßenrouten...\n`);

  const route = [];
  const routeGeometries = [];
  let totalOffroadKm = 0;
  let totalOnroadKm = 0;
  let totalCost = 0;

  for (let i = 0; i < selectedClusters.length; i++) {
    const cluster = selectedClusters[i];
    const nextCluster = selectedClusters[i + 1];

    const availableOffroad = Math.min(cluster.totalLength, maxOffroadPerDay);
    
    let connectionKm = 0;
    let connectionDuration = 0;
    let connectionGeometry = null;
    let routeFallback = false;

    if (nextCluster) {
      console.log(`🔄 Berechne Route: ${cluster.id} → ${nextCluster.id}...`);
      
      const osrmRoute = await getRoute(
        cluster.center.lat,
        cluster.center.lon,
        nextCluster.center.lat,
        nextCluster.center.lon
      );
      
      connectionKm = osrmRoute.distance;
      connectionDuration = osrmRoute.duration;
      connectionGeometry = osrmRoute.geometry;
      routeFallback = osrmRoute.fallback || false;
      
      if (routeFallback) {
        console.log(`   ⚠️  Luftlinie genutzt (OSRM nicht verfügbar)`);
      } else {
        console.log(`   ✅ ${connectionKm.toFixed(1)} km, ${Math.round(connectionDuration)} Min`);
      }
      
      // Rate-Limit vermeiden
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const budget = calculateBudget(availableOffroad, connectionKm, cluster.avgDifficulty);

    const day = {
      day: i + 1,
      cluster: cluster.id,
      center: cluster.center,
      nearestTown: cluster.nearestTown,
      offroad: {
        available: cluster.totalLength.toFixed(1),
        planned: availableOffroad.toFixed(1),
        tracks: cluster.trackCount
      },
      connection: {
        toNext: nextCluster ? nextCluster.id : "Ende",
        distance: connectionKm.toFixed(1),
        duration: Math.round(connectionDuration),
        routeType: routeFallback ? "Luftlinie" : "OSRM"
      },
      total: {
        offroad: availableOffroad.toFixed(1),
        onroad: connectionKm.toFixed(1),
        distance: (availableOffroad + connectionKm).toFixed(1),
        offroadPercentage: ((availableOffroad / (availableOffroad + connectionKm)) * 100).toFixed(0)
      },
      difficulty: cluster.avgDifficulty,
      budget: budget,
      osmLink: `https://www.openstreetmap.org/#map=12/${cluster.center.lat}/${cluster.center.lon}`
    };

    route.push(day);
    
    if (connectionGeometry) {
      routeGeometries.push({
        day: i + 1,
        from: cluster.id,
        to: nextCluster ? nextCluster.id : "Ende",
        geometry: connectionGeometry
      });
    }
    
    totalOffroadKm += availableOffroad;
    totalOnroadKm += connectionKm;
    totalCost += parseFloat(budget.cost.total);
  }

  // Ausgabe
  console.log("\n📅 TAGES-ETAPPEN:");
  console.log("─".repeat(80));

  route.forEach(day => {
    console.log(`\n🗓️  Tag ${day.day}: ${day.cluster}`);
    console.log(`   📍 Nähe: ${day.nearestTown}`);
    console.log(`   🛣️  Offroad: ${day.offroad.planned} km (${day.offroad.tracks} Tracks verfügbar)`);
    console.log(`   🚗 Verbindung: ${day.connection.distance} km → ${day.connection.toNext} (${day.connection.routeType})`);
    console.log(`   📏 Gesamt: ${day.total.distance} km (${day.total.offroadPercentage}% Offroad)`);
    console.log(`   ⚡ Schwierigkeit: ${day.difficulty}/100`);
    console.log(`   ⏱️  Zeit: ${day.budget.time.total}h (${day.budget.time.totalMinutes} Min)`);
    console.log(`   💰 Budget: ${day.budget.cost.total}€ (Sprit: ${day.budget.cost.fuel}€)`);
    console.log(`   🔗 Karte: ${day.osmLink}`);
  });

  // Gesamt-Statistik
  const totalDistance = totalOffroadKm + totalOnroadKm;
  const totalOffroadPercentage = (totalOffroadKm / totalDistance * 100).toFixed(0);
  const avgDifficulty = route.reduce((sum, d) => sum + d.difficulty, 0) / route.length;

  console.log("\n" + "=".repeat(80));
  console.log("📊 GESAMT-STATISTIK");
  console.log("=".repeat(80));
  console.log(`\n🗓️  Tage: ${route.length}`);
  console.log(`📏 Gesamt-Distanz: ${totalDistance.toFixed(1)} km`);
  console.log(`   🛣️  Offroad: ${totalOffroadKm.toFixed(1)} km (${totalOffroadPercentage}%)`);
  console.log(`   🚗 Asphalt: ${totalOnroadKm.toFixed(1)} km (${(100 - totalOffroadPercentage)}%)`);
  console.log(`⚡ Ø Schwierigkeit: ${avgDifficulty.toFixed(0)}/100`);
  console.log(`💰 Gesamt-Budget: ${totalCost.toFixed(2)}€`);

  const totalTime = route.reduce((sum, d) => sum + parseFloat(d.budget.time.total), 0);
  console.log(`⏱️  Gesamt-Fahrzeit: ${totalTime.toFixed(1)}h (${Math.round(totalTime * 60)} Min)`);
  console.log(`   Ø pro Tag: ${(totalTime / route.length).toFixed(1)}h\n`);

  // GeoJSON für Visualisierung
  const geojson = {
    type: "FeatureCollection",
    features: [
      // Marker für jeden Tag
      ...route.map(day => ({
        type: "Feature",
        properties: {
          day: day.day,
          cluster: day.cluster,
          location: day.nearestTown,
          offroad: `${day.offroad.planned} km`,
          difficulty: `${day.difficulty}/100`,
          budget: `${day.budget.cost.total}€`,
          description: `Tag ${day.day}: ${day.offroad.planned}km Offroad, ${day.connection.distance}km Verbindung`,
          "marker-color": ["#2ecc71", "#3498db", "#9b59b6", "#e74c3c", "#f39c12", "#1abc9c", "#e67e22"][day.day - 1] || "#95a5a6",
          "marker-size": "large",
          "marker-symbol": day.day.toString()
        },
        geometry: {
          type: "Point",
          coordinates: [day.center.lon, day.center.lat]
        }
      })),
      // Routen-Linien
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

  return {
    region: clusterData.region,
    days: route,
    summary: {
      totalDays: route.length,
      totalDistance: totalDistance,
      offroadKm: totalOffroadKm,
      onroadKm: totalOnroadKm,
      offroadPercentage: parseFloat(totalOffroadPercentage),
      avgDifficulty: avgDifficulty,
      totalCost: totalCost,
      totalTime: totalTime
    },
    geojson: geojson
  };
}

// Zeige Top-Cluster
function showTopClusters(clusterData, count = 20) {
  console.log("\n" + "=".repeat(80));
  console.log(`🏆 TOP ${count} CLUSTER in ${clusterData.region}`);
  console.log("=".repeat(80));
  console.log("\nID | Tracks | Offroad-km | Schwierigkeit | Nähe");
  console.log("─".repeat(80));

  clusterData.clusters.slice(0, count).forEach((c, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(2)}. ${c.id.padEnd(12)} | ` +
      `${c.trackCount.toString().padStart(6)} | ` +
      `${c.totalLength.toFixed(1).padStart(10)} | ` +
      `${c.avgDifficulty.toString().padStart(13)} | ` +
      `${c.nearestTown}`
    );
  });

  console.log("\n💡 Kopiere die Cluster-IDs für deine Route");
}

// Hauptfunktion
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("\n📖 VERWENDUNG:");
    console.log("─".repeat(80));
    console.log("\n1. Zeige Top-Cluster:");
    console.log("   node plan-multi-day-route-with-routing.js <region-file.json>");
    console.log("\n2. Plane Route mit OSRM:");
    console.log("   node plan-multi-day-route-with-routing.js <region-file.json> cluster_4,cluster_20,cluster_28");
    console.log("\nBeispiel:");
    console.log("   node plan-multi-day-route-with-routing.js region-pyrenees-1760452290235.json");
    console.log("   node plan-multi-day-route-with-routing.js region-pyrenees-1760452290235.json cluster_28,cluster_32,cluster_36\n");
    process.exit(0);
  }

  const dataFile = args[0];
  
  if (!fs.existsSync(dataFile)) {
    console.error(`❌ Datei nicht gefunden: ${dataFile}`);
    process.exit(1);
  }

  const clusterData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  if (args.length === 1) {
    showTopClusters(clusterData, 20);
    return;
  }

  const clusterIds = args[1].split(',').map(id => id.trim());
  const result = await planRouteWithRouting(clusterData, clusterIds);

  if (result) {
    // Speichere Route
    const outputFile = `route-${clusterData.region.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`💾 Route gespeichert: ${outputFile}`);
    
    // Speichere GeoJSON
    const geojsonFile = `route-${clusterData.region.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.geojson`;
    fs.writeFileSync(geojsonFile, JSON.stringify(result.geojson, null, 2));
    console.log(`💾 GeoJSON gespeichert: ${geojsonFile}`);
    console.log(`\n💡 Öffne ${geojsonFile} auf geojson.io für Visualisierung\n`);
  }
}

main();
