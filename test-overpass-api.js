// Test-Script für Overpass-API
// Testet verschiedene Queries und zeigt die Datenstruktur übersichtlich an

import fs from "node:fs";

// Alternative Overpass-Instanzen (falls eine überlastet ist)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

let currentEndpointIndex = 0;

// Konfigurierbare Parameter
const CONFIG = {
  minLengthMeters: 500,        // Mindestlänge in Metern (Standard: 500m)
  minDurationMinutes: 5,       // Mindest-Fahrzeit in Minuten (Standard: 5 Min)
  targetDurationMinutes: 30,   // Ziel-Fahrzeit für realistische Touren (Standard: 30 Min)
  
  // Fahrzeug-Profil (für FUSO Truck / größere Overlander)
  vehicleWidth: 2.3,           // Breite in Metern
  vehicleHeight: 3.5,          // Höhe in Metern
  vehicleWeight: 6.5,          // Gewicht in Tonnen
  requireMotorVehicleAccess: true,  // Nur Wege mit Motorfahrzeug-Zugang
};

// Verschiedene Test-Queries
const queries = {
  // 0) Mini Test-Query: 3km um Freiburg, nur fahrzeugtaugliche Wege
  mini: `
[out:json][timeout:25];
(
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     ["vehicle"!~"^(no|private)$"]
     ["bicycle"!="designated"]
     ["foot"!="designated"]
     (around:3000,47.999,7.842);
);
out tags geom;
`,

  // 1) Kleine Test-Query: 10km um Freiburg, nur fahrzeugtaugliche Wege
  small: `
[out:json][timeout:60];
(
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     ["vehicle"!~"^(no|private)$"]
     ["tracktype"~"^(grade1|grade2|grade3)$"]
     ["bicycle"!="designated"]
     ["foot"!="designated"]
     (around:10000,47.999,7.842);
);
out tags geom;
`,

  // 2) Mittlere Query: 25km um Freiburg, nur fahrzeugtaugliche Wege
  medium: `
[out:json][timeout:120];
(
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     ["vehicle"!~"^(no|private)$"]
     ["tracktype"~"^(grade1|grade2|grade3)$"]
     ["bicycle"!="designated"]
     ["foot"!="designated"]
     (around:25000,47.999,7.842);
);
out tags geom;
`,

  // 3) Große Query: 50km um Freiburg, nur fahrzeugtaugliche Wege
  large: `
[out:json][timeout:180];
(
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     ["vehicle"!~"^(no|private)$"]
     ["tracktype"~"^(grade1|grade2|grade3)$"]
     ["bicycle"!="designated"]
     ["foot"!="designated"]
     (around:50000,47.999,7.842);
);
out tags geom;
`,
};

// Haversine-Distanz in Metern
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // m
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Berechnet die Länge eines Weges
function wayLengthMeters(geometry) {
  if (!geometry || geometry.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < geometry.length; i++) {
    const p1 = geometry[i - 1];
    const p2 = geometry[i];
    sum += haversine(p1.lat, p1.lon, p2.lat, p2.lon);
  }
  return sum;
}

// Prüft ob ein Weg für das Fahrzeug geeignet ist
function isVehicleSuitable(tags, config) {
  const reasons = [];

  // 1. Motor Vehicle Access
  if (config.requireMotorVehicleAccess) {
    if (tags.motor_vehicle === 'no' || tags.motor_vehicle === 'private') {
      reasons.push('motor_vehicle verboten');
    }
    if (tags.vehicle === 'no' || tags.vehicle === 'private') {
      reasons.push('vehicle verboten');
    }
  }

  // 2. Nur Bike/Fußgänger-Wege ausschließen
  if (tags.bicycle === 'designated' && !tags.motor_vehicle) {
    reasons.push('Fahrrad-Weg');
  }
  if (tags.foot === 'designated' && !tags.motor_vehicle) {
    reasons.push('Fußgänger-Weg');
  }
  if (tags.sac_scale && !['hiking', 'mountain_hiking'].includes(tags.sac_scale)) {
    reasons.push(`SAC-Scale zu schwer: ${tags.sac_scale}`);
  }

  // 3. Breite prüfen
  if (tags.maxwidth) {
    const maxWidth = parseFloat(tags.maxwidth);
    if (!isNaN(maxWidth) && maxWidth < config.vehicleWidth) {
      reasons.push(`zu schmal: ${maxWidth}m < ${config.vehicleWidth}m`);
    }
  }
  if (tags.width) {
    const width = parseFloat(tags.width);
    if (!isNaN(width) && width < config.vehicleWidth) {
      reasons.push(`Breite zu gering: ${width}m`);
    }
  }

  // 4. Höhe prüfen
  if (tags.maxheight) {
    const maxHeight = parseFloat(tags.maxheight);
    if (!isNaN(maxHeight) && maxHeight < config.vehicleHeight) {
      reasons.push(`zu niedrig: ${maxHeight}m < ${config.vehicleHeight}m`);
    }
  }

  // 5. Gewicht prüfen
  if (tags.maxweight) {
    const maxWeight = parseFloat(tags.maxweight);
    if (!isNaN(maxWeight) && maxWeight < config.vehicleWeight) {
      reasons.push(`zu schwer: ${maxWeight}t < ${config.vehicleWeight}t`);
    }
  }

  // 6. Tracktype - grade4/grade5 sind oft zu schwierig für große Fahrzeuge
  if (tags.tracktype === 'grade5') {
    reasons.push('grade5 - keine Befestigung (zu schwierig)');
  }
  if (tags.tracktype === 'grade4' && config.vehicleWeight > 5) {
    reasons.push('grade4 - meist unbefestigt (schwierig für schwere Fahrzeuge)');
  }

  return {
    suitable: reasons.length === 0,
    reasons: reasons
  };
}

// Filtert Wege nach Mindestlänge, Fahrzeit und Fahrzeug-Eignung
function filterWaysByLength(elements, minLengthM, minDurationMin, config = CONFIG) {
  const filtered = [];
  const rejected = [];

  elements.forEach((el) => {
    if (el.type !== 'way') return;

    const lengthM = wayLengthMeters(el.geometry);
    const tags = el.tags || {};
    
    // Prüfe Fahrzeug-Eignung
    const vehicleCheck = isVehicleSuitable(tags, config);
    
    // Berechne geschätzte Fahrzeit basierend auf Schwierigkeit
    const score = estimateDifficultyScore(tags);
    const avgSpeed = score <= 30 ? 40 : score <= 60 ? 25 : 15;
    const durationMin = (lengthM / 1000 / avgSpeed) * 60;

    // Filter: Länge, Fahrzeit UND Fahrzeug-Eignung
    if (lengthM >= minLengthM && durationMin >= minDurationMin && vehicleCheck.suitable) {
      filtered.push(el);
    } else {
      let reason = [];
      if (lengthM < minLengthM) reason.push('zu kurz');
      if (durationMin < minDurationMin) reason.push('zu schnell');
      if (!vehicleCheck.suitable) reason.push(...vehicleCheck.reasons);
      
      rejected.push({
        id: el.id,
        lengthM: lengthM.toFixed(0),
        durationMin: durationMin.toFixed(1),
        reason: reason.join(', ')
      });
    }
  });

  return { filtered, rejected };
}

// Schnelle Schwierigkeits-Schätzung (ohne vollständige Berechnung)
function estimateDifficultyScore(tags) {
  let score = 20; // Basis
  
  const surfaceScores = {
    'gravel': 15, 'ground': 25, 'dirt': 30, 'sand': 35, 'rock': 40
  };
  score += surfaceScores[tags.surface] || 20;
  
  const tracktypeScores = {
    'grade1': 0, 'grade2': 10, 'grade3': 20, 'grade4': 25, 'grade5': 30
  };
  score += tracktypeScores[tags.tracktype] || 15;
  
  return Math.min(score, 100);
}

// Analysiert und gibt Statistiken aus
function analyzeData(data, queryName, config = CONFIG) {
  console.log("\n" + "=".repeat(80));
  console.log(`ANALYSE: ${queryName.toUpperCase()}`);
  console.log("=".repeat(80));

  const allElements = data.elements ?? [];
  console.log(`\n📊 Anzahl gefundener Wege (roh): ${allElements.length}`);

  if (allElements.length === 0) {
    console.log("❌ Keine Daten gefunden!");
    return null;
  }

  // Filtere nach Mindestlänge, Fahrzeit und Fahrzeug-Eignung
  console.log(`\n🔍 Filtere Wege (Min: ${config.minLengthMeters}m, ${config.minDurationMinutes} Min)...`);
  console.log(`🚛 Fahrzeug-Profil: ${config.vehicleWidth}m breit, ${config.vehicleHeight}m hoch, ${config.vehicleWeight}t`);
  const { filtered: elements, rejected } = filterWaysByLength(
    allElements,
    config.minLengthMeters,
    config.minDurationMinutes,
    config
  );

  console.log(`✅ ${elements.length} Wege erfüllen die Kriterien`);
  console.log(`❌ ${rejected.length} Wege zu kurz/schnell\n`);

  if (rejected.length > 0) {
    console.log("\n📋 Ausgeschlossene Wege (Beispiele):");
    rejected.slice(0, 10).forEach((r) => {
      console.log(`   - OSM ${r.id}: ${r.lengthM}m, ~${r.durationMin} Min`);
      console.log(`     ❌ ${r.reason}`);
    });
    console.log("");
  }

  if (elements.length === 0) {
    console.log("❌ Keine Wege erfüllen die Mindestkriterien!");
    console.log("💡 Tipp: Reduziere minLengthMeters oder minDurationMinutes\n");
    return null;
  }

  // Statistiken sammeln
  const stats = {
    totalWaysRaw: allElements.length,
    totalWaysFiltered: elements.length,
    rejectedWays: rejected.length,
    totalLength: 0,
    highways: {},
    surfaces: {},
    tracktypes: {},
    smoothness: {},
    withNames: 0,
    avgNodesPerWay: 0,
    minLength: Infinity,
    maxLength: 0,
    estimatedDuration: 0,
  };

  const sampleWays = [];
  let totalNodes = 0;

  elements.forEach((el, idx) => {
    if (el.type !== "way") return;

    const tags = el.tags ?? {};
    const length = wayLengthMeters(el.geometry);
    const nodes = el.geometry?.length ?? 0;

    stats.totalLength += length;
    totalNodes += nodes;

    if (length < stats.minLength) stats.minLength = length;
    if (length > stats.maxLength) stats.maxLength = length;

    // Geschätzte Fahrzeit
    const score = estimateDifficultyScore(tags);
    const avgSpeed = score <= 30 ? 40 : score <= 60 ? 25 : 15;
    stats.estimatedDuration += (length / 1000 / avgSpeed) * 60;

    // Kategorien zählen
    stats.highways[tags.highway] = (stats.highways[tags.highway] || 0) + 1;
    stats.surfaces[tags.surface] = (stats.surfaces[tags.surface] || 0) + 1;
    if (tags.tracktype) stats.tracktypes[tags.tracktype] = (stats.tracktypes[tags.tracktype] || 0) + 1;
    if (tags.smoothness) stats.smoothness[tags.smoothness] = (stats.smoothness[tags.smoothness] || 0) + 1;
    if (tags.name) stats.withNames++;

    // Erste 3 Wege als Beispiele speichern
    if (idx < 3) {
      sampleWays.push({
        id: el.id,
        tags: tags,
        length_m: length.toFixed(1),
        length_km: (length / 1000).toFixed(3),
        nodes: nodes,
        firstCoord: el.geometry?.[0],
        lastCoord: el.geometry?.[el.geometry.length - 1],
      });
    }
  });

  stats.avgNodesPerWay = (totalNodes / elements.length).toFixed(1);

  // Ausgabe
  console.log(`\n📏 Gesamtlänge: ${(stats.totalLength / 1000).toFixed(2)} km`);
  console.log(`📏 Durchschnittliche Weglänge: ${(stats.totalLength / elements.length / 1000).toFixed(3)} km`);
  console.log(`📏 Kürzester Weg: ${(stats.minLength / 1000).toFixed(2)} km`);
  console.log(`📏 Längster Weg: ${(stats.maxLength / 1000).toFixed(2)} km`);
  console.log(`⏱️  Geschätzte Gesamt-Fahrzeit: ${(stats.estimatedDuration / 60).toFixed(1)}h (${Math.round(stats.estimatedDuration)} Min)`);
  console.log(`⏱️  Ø Fahrzeit pro Weg: ${(stats.estimatedDuration / elements.length).toFixed(1)} Min`);
  console.log(`📍 Durchschnittliche Nodes pro Weg: ${stats.avgNodesPerWay}`);
  console.log(`🏷️  Wege mit Namen: ${stats.withNames} (${((stats.withNames / elements.length) * 100).toFixed(1)}%)`);

  console.log("\n🛣️  Highway-Typen:");
  Object.entries(stats.highways)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} (${((count / elements.length) * 100).toFixed(1)}%)`);
    });

  console.log("\n🏞️  Oberflächen:");
  Object.entries(stats.surfaces)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} (${((count / elements.length) * 100).toFixed(1)}%)`);
    });

  if (Object.keys(stats.tracktypes).length > 0) {
    console.log("\n🚜 Track-Typen:");
    Object.entries(stats.tracktypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
  }

  if (Object.keys(stats.smoothness).length > 0) {
    console.log("\n🌊 Smoothness:");
    Object.entries(stats.smoothness)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
  }

  // Beispiel-Wege ausgeben
  console.log("\n📋 BEISPIEL-WEGE (erste 3):");
  console.log("─".repeat(80));
  sampleWays.forEach((way, idx) => {
    console.log(`\n${idx + 1}. OSM-ID: ${way.id}`);
    console.log(`   Länge: ${way.length_km} km (${way.length_m} m)`);
    console.log(`   Nodes: ${way.nodes}`);
    console.log(`   Highway: ${way.tags.highway || "N/A"}`);
    console.log(`   Surface: ${way.tags.surface || "N/A"}`);
    console.log(`   Tracktype: ${way.tags.tracktype || "N/A"}`);
    console.log(`   Smoothness: ${way.tags.smoothness || "N/A"}`);
    console.log(`   Name: ${way.tags.name || "Unbenannt"}`);
    console.log(`   Access: ${way.tags.access || "N/A"}`);
    console.log(`   Motor Vehicle: ${way.tags.motor_vehicle || "N/A"}`);
    
    // Warnungen basierend auf Tags
    const warnings = [];
    if (way.tags.motor_vehicle === 'forestry') {
      warnings.push("⚠️  Nur für Forstfahrzeuge - Zugang möglicherweise eingeschränkt");
    }
    if (way.tags.motor_vehicle === 'agricultural') {
      warnings.push("⚠️  Nur für landwirtschaftliche Fahrzeuge");
    }
    if (!way.tags.motor_vehicle || way.tags.motor_vehicle === 'yes') {
      warnings.push("⚠️  Erreichbarkeit nicht geprüft - vor Ort verifizieren!");
    }
    if (way.tags.surface === 'ground' || way.tags.surface === 'dirt') {
      warnings.push("⚠️  Naturboden - bei Regen möglicherweise unpassierbar");
    }
    if (!way.tags.width && !way.tags.maxwidth) {
      warnings.push("⚠️  Wegbreite unbekannt - Durchfahrt für große Fahrzeuge unsicher");
    }
    
    console.log(`   Start: ${way.firstCoord?.lat}, ${way.firstCoord?.lon}`);
    console.log(`   Ende: ${way.lastCoord?.lat}, ${way.lastCoord?.lon}`);
    console.log(`   OSM-Link: https://www.openstreetmap.org/way/${way.id}`);
    
    if (warnings.length > 0) {
      console.log(`\n   WARNUNGEN:`);
      warnings.forEach(w => console.log(`   ${w}`));
    }
  });

  return stats;
}

// Hauptfunktion
async function testOverpassAPI(querySize = "small", customConfig = null) {
  const config = customConfig || CONFIG;
  const query = queries[querySize];

  if (!query) {
    console.error(`❌ Ungültige Query-Größe: ${querySize}`);
    console.log(`Verfügbare Größen: ${Object.keys(queries).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🚀 Starte Overpass-API Test (${querySize})...`);
  console.log(`📍 Suchgebiet: Freiburg im Breisgau`);
  console.log(`🔍 Query-Typ: ${querySize}`);
  console.log(`⏱️  Bitte warten, API-Anfrage läuft...\n`);

  const startTime = Date.now();
  let lastError = null;

  // Versuche verschiedene Overpass-Instanzen
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt];
    console.log(`🌐 Versuche Endpoint ${attempt + 1}/${OVERPASS_ENDPOINTS.length}: ${endpoint}`);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: query }).toString(),
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!res.ok) {
        console.warn(`⚠️  Endpoint ${attempt + 1} Fehler: ${res.status}`);
        const errorText = await res.text();
        if (errorText.includes("runtime error") || errorText.includes("timeout") || errorText.includes("too busy")) {
          console.warn(`   Server überlastet, versuche nächsten Endpoint...\n`);
          lastError = `${res.status}: Server überlastet`;
          continue; // Nächsten Endpoint versuchen
        }
        console.error(errorText);
        process.exit(1);
      }

      console.log(`✅ API-Antwort erhalten von Endpoint ${attempt + 1} (${duration}s)`);

      const data = await res.json();

      // Rohdaten speichern
      const rawFilename = `overpass-raw-${querySize}-${Date.now()}.json`;
      fs.writeFileSync(rawFilename, JSON.stringify(data, null, 2));
      console.log(`💾 Rohdaten gespeichert: ${rawFilename}`);

      // Daten analysieren
      const stats = analyzeData(data, querySize, config);

      if (stats) {
        // Statistiken speichern
        const statsFilename = `overpass-stats-${querySize}-${Date.now()}.json`;
        fs.writeFileSync(statsFilename, JSON.stringify(stats, null, 2));
        console.log(`\n💾 Statistiken gespeichert: ${statsFilename}`);
      }

      console.log("\n" + "=".repeat(80));
      console.log("✅ TEST ABGESCHLOSSEN");
      console.log("=".repeat(80));
      console.log("\n💡 FAZIT:");
      console.log("   Die Overpass-API liefert detaillierte Daten über Offroad-Wege.");
      console.log("   Jeder Weg enthält:");
      console.log("   - GPS-Koordinaten (geometry)");
      console.log("   - Straßentyp (highway)");
      console.log("   - Oberfläche (surface)");
      console.log("   - Optional: tracktype, smoothness, name, access, etc.");
      console.log("\n   Diese Daten können für folgendes genutzt werden:");
      console.log("   ✓ Offroad-Routen auf Karte anzeigen");
      console.log("   ✓ Scoring-System (Schwierigkeit basierend auf surface/tracktype)");
      console.log("   ✓ Distanz- und Budget-Berechnung");
      console.log("   ✓ Filter nach Fahrzeug-Constraints (maxweight, maxwidth, etc.)");
      console.log("\n");
      return; // Erfolgreich, beende Funktion

    } catch (error) {
      console.warn(`⚠️  Endpoint ${attempt + 1} Fehler: ${error.message}`);
      lastError = error.message;
      if (attempt < OVERPASS_ENDPOINTS.length - 1) {
        console.warn(`   Versuche nächsten Endpoint...\n`);
        continue;
      }
    }
  }

  // Alle Endpoints fehlgeschlagen
  console.error("\n❌ Alle Overpass-Endpoints fehlgeschlagen!");
  console.error(`Letzter Fehler: ${lastError}`);
  console.log("\n💡 TIPPS:");
  console.log("   - Versuche es in ein paar Minuten erneut");
  console.log("   - Nutze 'mini' für einen sehr kleinen Test-Bereich");
  console.log("   - Die öffentlichen Overpass-Server sind manchmal überlastet");
  process.exit(1);
}

// Script ausführen
const querySize = process.argv[2] || "small";

// Optionale Parameter aus Kommandozeile
const customConfig = { ...CONFIG };

if (process.argv[3]) {
  customConfig.minLengthMeters = parseInt(process.argv[3]);
  console.log(`⚙️  Custom minLengthMeters: ${customConfig.minLengthMeters}m`);
}

if (process.argv[4]) {
  customConfig.minDurationMinutes = parseInt(process.argv[4]);
  console.log(`⚙️  Custom minDurationMinutes: ${customConfig.minDurationMinutes} Min`);
}

if (process.argv[5]) {
  customConfig.targetDurationMinutes = parseInt(process.argv[5]);
  console.log(`⚙️  Custom targetDurationMinutes: ${customConfig.targetDurationMinutes} Min`);
}

testOverpassAPI(querySize, customConfig);
