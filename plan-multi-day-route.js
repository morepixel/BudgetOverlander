// Plant eine Multi-Day-Route basierend auf Cluster-Daten
// Nutzer wählt Cluster aus und bekommt Tages-Etappen mit Budget

import fs from "node:fs";

// Haversine-Distanz zwischen zwei Punkten
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Berechne Budget für eine Etappe
function calculateBudget(offroadKm, onroadKm, difficulty, fuelPrice = 1.65) {
  const baseConsumption = 12; // L/100km
  
  // Offroad-Faktor basierend auf Schwierigkeit
  const offroadFactor = difficulty <= 40 ? 1.3 : difficulty <= 60 ? 1.5 : 1.7;
  
  // Spritverbrauch
  const offroadFuel = (offroadKm / 100) * baseConsumption * offroadFactor;
  const onroadFuel = (onroadKm / 100) * baseConsumption;
  const totalFuel = offroadFuel + onroadFuel;
  const fuelCost = totalFuel * fuelPrice;
  
  // Fahrzeit (Offroad langsamer)
  const offroadSpeed = difficulty <= 40 ? 35 : difficulty <= 60 ? 25 : 18;
  const onroadSpeed = 70; // Landstraßen
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
      camping: 15, // Durchschnitt
      food: 25, // Durchschnitt
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

// Plane Route durch ausgewählte Cluster
function planRoute(clusterData, selectedClusterIds, config = {}) {
  const {
    maxOffroadPerDay = 80, // Max km Offroad pro Tag
    targetOffroadPercentage = 60, // Ziel: 60% Offroad
  } = config;

  // Lade ausgewählte Cluster
  const selectedClusters = clusterData.clusters.filter(c => 
    selectedClusterIds.includes(c.id)
  );

  if (selectedClusters.length === 0) {
    console.error("❌ Keine Cluster ausgewählt!");
    return null;
  }

  console.log("\n" + "=".repeat(80));
  console.log("🗺️  MULTI-DAY ROUTEN-PLANUNG");
  console.log("=".repeat(80));
  console.log(`\n📍 Region: ${clusterData.region}`);
  console.log(`📊 Ausgewählte Cluster: ${selectedClusters.length}`);
  console.log(`🎯 Ziel: ${targetOffroadPercentage}% Offroad\n`);

  // Berechne Distanzen zwischen Clustern
  const route = [];
  let totalOffroadKm = 0;
  let totalOnroadKm = 0;
  let totalCost = 0;

  for (let i = 0; i < selectedClusters.length; i++) {
    const cluster = selectedClusters[i];
    const nextCluster = selectedClusters[i + 1];

    // Verfügbares Offroad im Cluster
    const availableOffroad = Math.min(cluster.totalLength, maxOffroadPerDay);
    
    // Distanz zum nächsten Cluster (Luftlinie * 1.3 für Straßen)
    const connectionKm = nextCluster 
      ? haversine(
          cluster.center.lat, cluster.center.lon,
          nextCluster.center.lat, nextCluster.center.lon
        ) * 1.3
      : 0;

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
        distance: connectionKm.toFixed(1)
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
    totalOffroadKm += availableOffroad;
    totalOnroadKm += connectionKm;
    totalCost += parseFloat(budget.cost.total);
  }

  // Ausgabe
  console.log("📅 TAGES-ETAPPEN:");
  console.log("─".repeat(80));

  route.forEach(day => {
    console.log(`\n🗓️  Tag ${day.day}: ${day.cluster}`);
    console.log(`   📍 Nähe: ${day.nearestTown}`);
    console.log(`   🛣️  Offroad: ${day.offroad.planned} km (${day.offroad.tracks} Tracks verfügbar)`);
    console.log(`   🚗 Verbindung: ${day.connection.distance} km → ${day.connection.toNext}`);
    console.log(`   📏 Gesamt: ${day.total.distance} km (${day.total.offroadPercentage}% Offroad)`);
    console.log(`   ⚡ Schwierigkeit: ${day.difficulty}/100`);
    console.log(`   ⏱️  Zeit: ${day.budget.time.total}h (${day.budget.time.totalMinutes} Min)`);
    console.log(`   💰 Budget: ${day.budget.cost.total}€ (Sprit: ${day.budget.cost.fuel}€, Camping: ${day.budget.cost.camping}€, Essen: ${day.budget.cost.food}€)`);
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
  console.log(`   Sprit: ${route.reduce((sum, d) => sum + parseFloat(d.budget.cost.fuel), 0).toFixed(2)}€`);
  console.log(`   Camping: ${route.length * 15}€`);
  console.log(`   Essen: ${route.length * 25}€`);

  const totalTime = route.reduce((sum, d) => sum + parseFloat(d.budget.time.total), 0);
  console.log(`⏱️  Gesamt-Fahrzeit: ${totalTime.toFixed(1)}h (${Math.round(totalTime * 60)} Min)`);
  console.log(`   Ø pro Tag: ${(totalTime / route.length).toFixed(1)}h\n`);

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
    }
  };
}

// Interaktive Cluster-Auswahl
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

  console.log("\n💡 Kopiere die Cluster-IDs für deine Route (z.B. cluster_4,cluster_20,cluster_28)");
}

// Hauptfunktion
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("\n📖 VERWENDUNG:");
    console.log("─".repeat(80));
    console.log("\n1. Zeige Top-Cluster:");
    console.log("   node plan-multi-day-route.js <region-file.json>");
    console.log("\n2. Plane Route:");
    console.log("   node plan-multi-day-route.js <region-file.json> cluster_4,cluster_20,cluster_28");
    console.log("\nBeispiel:");
    console.log("   node plan-multi-day-route.js region-pyrenees-1760452290235.json");
    console.log("   node plan-multi-day-route.js region-pyrenees-1760452290235.json cluster_4,cluster_20,cluster_28\n");
    process.exit(0);
  }

  const dataFile = args[0];
  
  if (!fs.existsSync(dataFile)) {
    console.error(`❌ Datei nicht gefunden: ${dataFile}`);
    process.exit(1);
  }

  const clusterData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  // Nur Top-Cluster anzeigen
  if (args.length === 1) {
    showTopClusters(clusterData, 20);
    return;
  }

  // Route planen
  const clusterIds = args[1].split(',').map(id => id.trim());
  const route = planRoute(clusterData, clusterIds);

  if (route) {
    // Speichere Route
    const outputFile = `route-${clusterData.region.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(route, null, 2));
    console.log(`💾 Route gespeichert: ${outputFile}\n`);
  }
}

main();
