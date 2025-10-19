// Beispiel: Scoring-System für Offroad-Wege
// Basierend auf den Overpass-API Daten

import fs from "node:fs";

// Schwierigkeits-Score berechnen (0-100 Punkte)
function calculateDifficultyScore(tags) {
  let score = 0;

  // Surface (0-40 Punkte)
  const surfaceScores = {
    paved: 0,
    asphalt: 0,
    concrete: 0,
    compacted: 5,
    fine_gravel: 10,
    gravel: 15,
    ground: 25,
    dirt: 30,
    sand: 35,
    rock: 40,
    unpaved: 20,
  };
  score += surfaceScores[tags.surface] || 20;

  // Tracktype (0-30 Punkte)
  const tracktypeScores = {
    grade1: 0,
    grade2: 10,
    grade3: 20,
    grade4: 25,
    grade5: 30,
  };
  score += tracktypeScores[tags.tracktype] || 15;

  // Smoothness (0-30 Punkte)
  const smoothnessScores = {
    excellent: 0,
    good: 5,
    intermediate: 10,
    bad: 15,
    very_bad: 20,
    horrible: 25,
    very_horrible: 30,
    impassable: 30,
  };
  score += smoothnessScores[tags.smoothness] || 10;

  return Math.min(score, 100);
}

// Kategorie basierend auf Score
function getDifficultyCategory(score) {
  if (score <= 30) return { level: "Leicht", emoji: "🟢", color: "#22c55e" };
  if (score <= 60) return { level: "Mittel", emoji: "🟡", color: "#eab308" };
  return { level: "Schwer", emoji: "🔴", color: "#ef4444" };
}

// Geschwindigkeit basierend auf Schwierigkeit (km/h)
function getAverageSpeed(score) {
  if (score <= 30) return 40;
  if (score <= 60) return 25;
  return 15;
}

// Spritverbrauch-Faktor
function getFuelConsumptionFactor(score) {
  if (score <= 30) return 1.2; // +20%
  if (score <= 60) return 1.4; // +40%
  return 1.6; // +60%
}

// Budget berechnen
function calculateBudget(lengthKm, score, baseConsumption = 12, fuelPrice = 1.65) {
  const factor = getFuelConsumptionFactor(score);
  const offroadConsumption = baseConsumption * factor;
  const fuelNeeded = (lengthKm / 100) * offroadConsumption;
  const fuelCost = fuelNeeded * fuelPrice;

  const avgSpeed = getAverageSpeed(score);
  const timeHours = lengthKm / avgSpeed;

  return {
    fuelNeeded: fuelNeeded.toFixed(2),
    fuelCost: fuelCost.toFixed(2),
    timeHours: timeHours.toFixed(2),
    timeMinutes: Math.round(timeHours * 60),
    avgSpeed,
    consumptionPer100km: offroadConsumption.toFixed(1),
  };
}

// Haversine-Distanz
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function wayLengthMeters(geometry) {
  if (!geometry || geometry.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < geometry.length; i++) {
    sum += haversine(
      geometry[i - 1].lat,
      geometry[i - 1].lon,
      geometry[i].lat,
      geometry[i].lon
    );
  }
  return sum;
}

// Hauptfunktion: Analysiere gespeicherte Overpass-Daten
function analyzeWithScoring(filename) {
  console.log("\n🎯 SCORING-ANALYSE");
  console.log("=".repeat(80));

  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  const elements = data.elements || [];

  console.log(`\n📊 Analysiere ${elements.length} Wege...\n`);

  const results = [];
  const stats = {
    easy: 0,
    medium: 0,
    hard: 0,
    totalLength: 0,
    totalFuelCost: 0,
    totalTime: 0,
  };

  elements.forEach((el) => {
    if (el.type !== "way") return;

    const tags = el.tags || {};
    const lengthM = wayLengthMeters(el.geometry);
    const lengthKm = lengthM / 1000;

    const score = calculateDifficultyScore(tags);
    const category = getDifficultyCategory(score);
    const budget = calculateBudget(lengthKm, score);

    results.push({
      id: el.id,
      name: tags.name || "Unbenannt",
      lengthKm: lengthKm.toFixed(3),
      score,
      category: category.level,
      emoji: category.emoji,
      surface: tags.surface,
      tracktype: tags.tracktype,
      smoothness: tags.smoothness,
      budget,
    });

    // Statistiken
    if (score <= 30) stats.easy++;
    else if (score <= 60) stats.medium++;
    else stats.hard++;

    stats.totalLength += lengthKm;
    stats.totalFuelCost += parseFloat(budget.fuelCost);
    stats.totalTime += parseFloat(budget.timeHours);
  });

  // Sortiere nach Schwierigkeit
  results.sort((a, b) => b.score - a.score);

  // Top 10 schwerste Wege
  console.log("🔴 TOP 10 SCHWERSTE WEGE:");
  console.log("─".repeat(80));
  results.slice(0, 10).forEach((way, idx) => {
    console.log(`\n${idx + 1}. ${way.emoji} ${way.name} (OSM: ${way.id})`);
    console.log(`   Score: ${way.score}/100 (${way.category})`);
    console.log(`   Länge: ${way.lengthKm} km`);
    console.log(`   Surface: ${way.surface || "N/A"}, Tracktype: ${way.tracktype || "N/A"}`);
    console.log(`   Budget: ${way.budget.fuelCost}€ Sprit, ${way.budget.timeMinutes} Min`);
  });

  // Statistiken
  console.log("\n\n📊 GESAMT-STATISTIKEN:");
  console.log("─".repeat(80));
  console.log(`\n🟢 Leichte Wege: ${stats.easy} (${((stats.easy / elements.length) * 100).toFixed(1)}%)`);
  console.log(`🟡 Mittlere Wege: ${stats.medium} (${((stats.medium / elements.length) * 100).toFixed(1)}%)`);
  console.log(`🔴 Schwere Wege: ${stats.hard} (${((stats.hard / elements.length) * 100).toFixed(1)}%)`);
  console.log(`\n📏 Gesamtlänge: ${stats.totalLength.toFixed(2)} km`);
  console.log(`⛽ Gesamt-Spritkosten: ${stats.totalFuelCost.toFixed(2)}€`);
  console.log(`⏱️  Gesamt-Fahrzeit: ${stats.totalTime.toFixed(2)}h (${Math.round(stats.totalTime * 60)} Min)`);

  // Durchschnitte
  console.log(`\n📈 Durchschnittswerte pro Weg:`);
  console.log(`   Länge: ${(stats.totalLength / elements.length).toFixed(3)} km`);
  console.log(`   Sprit: ${(stats.totalFuelCost / elements.length).toFixed(2)}€`);
  console.log(`   Zeit: ${Math.round((stats.totalTime / elements.length) * 60)} Min`);

  // Speichere Ergebnisse
  const outputFile = filename.replace("raw", "scored");
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Scoring-Ergebnisse gespeichert: ${outputFile}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ SCORING ABGESCHLOSSEN\n");
}

// Script ausführen
const filename = process.argv[2] || "overpass-raw-mini-1760450353600.json";

if (!fs.existsSync(filename)) {
  console.error(`❌ Datei nicht gefunden: ${filename}`);
  console.log("\nVerwendung: node beispiel-scoring.js <overpass-raw-datei.json>");
  process.exit(1);
}

analyzeWithScoring(filename);
