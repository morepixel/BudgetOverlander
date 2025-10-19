// Länder-spezifisches Test-Script für Overpass-API
// Deutschland: Einsame Landstraßen
// Spanien/Frankreich/Norwegen: Offroad-Tracks

import fs from "node:fs";

// Alternative Overpass-Instanzen
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

// Länder-Konfigurationen
const COUNTRY_CONFIGS = {
  // Deutschland: Einsame, romantische Landstraßen (wenig Verkehr, schöne Landschaft)
  germany: {
    name: "Deutschland",
    center: { lat: 48.0, lon: 8.0 }, // Schwarzwald als Beispiel
    queryType: "scenic_roads",
    description: "Einsame, asphaltierte Landstraßen mit wenig Verkehr",
    vehicleWidth: 2.3,
    vehicleHeight: 3.5,
    vehicleWeight: 7.5,
    minLengthMeters: 500,
    minDurationMinutes: 3,
  },
  
  // Spanien: Offroad-Tracks (viel freier zugänglich)
  spain: {
    name: "Spanien",
    center: { lat: 40.5, lon: -3.5 }, // Zentralspanien
    queryType: "offroad_tracks",
    description: "Offroad-Tracks und Pistas (oft öffentlich zugänglich)",
    vehicleWidth: 2.3,
    vehicleHeight: 3.5,
    vehicleWeight: 7.5,
    minLengthMeters: 3000,
    minDurationMinutes: 15,
  },
  
  // Frankreich: Mix aus Offroad und einsamen Straßen
  france: {
    name: "Frankreich",
    center: { lat: 44.5, lon: 6.5 }, // Alpen/Provence
    queryType: "offroad_tracks",
    description: "Chemins ruraux und Pistes forestières",
    vehicleWidth: 2.3,
    vehicleHeight: 3.5,
    vehicleWeight: 7.5,
    minLengthMeters: 2500,
    minDurationMinutes: 12,
  },
  
  // Norwegen: Offroad sehr frei zugänglich (Jedermannsrecht)
  norway: {
    name: "Norwegen",
    center: { lat: 61.0, lon: 8.5 }, // Zentralnorwegen
    queryType: "offroad_tracks",
    description: "Offroad-Tracks (Jedermannsrecht gilt)",
    vehicleWidth: 2.3,
    vehicleHeight: 3.5,
    vehicleWeight: 7.5,
    minLengthMeters: 3000,
    minDurationMinutes: 15,
  },
};

// Query-Templates nach Typ
const QUERY_TEMPLATES = {
  // Einsame Landstraßen (Deutschland)
  scenic_roads: (lat, lon, radius) => `
[out:json][timeout:120];
(
  // Kleine Landstraßen mit wenig Verkehr
  way["highway"~"^(tertiary|unclassified)$"]
     ["surface"~"^(asphalt|paved|concrete)$"]
     ["lanes"~"^(1|2)$"]
     ["maxspeed"~"^(50|60|70|80)$"]
     ["access"!~"^(private|no)$"]
     (around:${radius},${lat},${lon});
  
  // Sehr kleine Straßen
  way["highway"="tertiary"]
     ["surface"~"^(asphalt|paved)$"]
     ["access"!~"^(private|no)$"]
     (around:${radius},${lat},${lon});
);
out tags geom;
`,

  // Offroad-Tracks (Spanien, Frankreich, Norwegen)
  offroad_tracks: (lat, lon, radius) => `
[out:json][timeout:120];
(
  // Offroad-Tracks (grade1-3, öffentlich zugänglich)
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["tracktype"~"^(grade1|grade2|grade3)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     (around:${radius},${lat},${lon});
  
  // Pistas/Chemins (spanisch/französisch für Feldwege)
  way["highway"="track"]
     ["surface"~"^(gravel|compacted|unpaved)$"]
     ["access"="yes"]
     (around:${radius},${lat},${lon});
);
out tags geom;
`,
};

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

// Schwierigkeits-Schätzung
function estimateDifficultyScore(tags, queryType) {
  if (queryType === 'scenic_roads') {
    // Landstraßen sind immer leicht
    return 10;
  }
  
  let score = 20;
  const surfaceScores = {
    'gravel': 15, 'ground': 25, 'dirt': 30, 'sand': 35, 'rock': 40, 'compacted': 10
  };
  score += surfaceScores[tags.surface] || 20;
  
  const tracktypeScores = {
    'grade1': 0, 'grade2': 10, 'grade3': 20, 'grade4': 25, 'grade5': 30
  };
  score += tracktypeScores[tags.tracktype] || 15;
  
  return Math.min(score, 100);
}

// Fahrzeug-Eignung prüfen
function isVehicleSuitable(tags, config, queryType) {
  const reasons = [];

  // Für Landstraßen: Einfachere Prüfung
  if (queryType === 'scenic_roads') {
    if (tags.maxheight) {
      const maxHeight = parseFloat(tags.maxheight);
      if (!isNaN(maxHeight) && maxHeight < config.vehicleHeight) {
        reasons.push(`zu niedrig: ${maxHeight}m < ${config.vehicleHeight}m`);
      }
    }
    if (tags.maxweight) {
      const maxWeight = parseFloat(tags.maxweight);
      if (!isNaN(maxWeight) && maxWeight < config.vehicleWeight) {
        reasons.push(`zu schwer: ${maxWeight}t < ${config.vehicleWeight}t`);
      }
    }
    return { suitable: reasons.length === 0, reasons };
  }

  // Für Offroad: Vollständige Prüfung
  if (tags.motor_vehicle === 'no' || tags.motor_vehicle === 'private') {
    reasons.push('motor_vehicle verboten');
  }
  if (tags.vehicle === 'no' || tags.vehicle === 'private') {
    reasons.push('vehicle verboten');
  }
  if (tags.tracktype === 'grade5') {
    reasons.push('grade5 - zu schwierig');
  }
  if (tags.tracktype === 'grade4' && config.vehicleWeight > 5) {
    reasons.push('grade4 - schwierig für schwere Fahrzeuge');
  }
  if (tags.maxwidth) {
    const maxWidth = parseFloat(tags.maxwidth);
    if (!isNaN(maxWidth) && maxWidth < config.vehicleWidth) {
      reasons.push(`zu schmal: ${maxWidth}m`);
    }
  }
  if (tags.maxheight) {
    const maxHeight = parseFloat(tags.maxheight);
    if (!isNaN(maxHeight) && maxHeight < config.vehicleHeight) {
      reasons.push(`zu niedrig: ${maxHeight}m`);
    }
  }
  if (tags.maxweight) {
    const maxWeight = parseFloat(tags.maxweight);
    if (!isNaN(maxWeight) && maxWeight < config.vehicleWeight) {
      reasons.push(`zu schwer: ${maxWeight}t`);
    }
  }

  return { suitable: reasons.length === 0, reasons };
}

// Filter nach Länge und Eignung
function filterWays(elements, config, queryType) {
  const filtered = [];
  const rejected = [];

  elements.forEach((el) => {
    if (el.type !== 'way') return;

    const lengthM = wayLengthMeters(el.geometry);
    const tags = el.tags || {};
    
    const vehicleCheck = isVehicleSuitable(tags, config, queryType);
    const score = estimateDifficultyScore(tags, queryType);
    const avgSpeed = queryType === 'scenic_roads' ? 50 : (score <= 30 ? 40 : score <= 60 ? 25 : 15);
    const durationMin = (lengthM / 1000 / avgSpeed) * 60;

    if (lengthM >= config.minLengthMeters && durationMin >= config.minDurationMinutes && vehicleCheck.suitable) {
      filtered.push(el);
    } else {
      let reason = [];
      if (lengthM < config.minLengthMeters) reason.push('zu kurz');
      if (durationMin < config.minDurationMinutes) reason.push('zu schnell');
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

// Analyse
function analyzeData(data, countryConfig) {
  console.log("\n" + "=".repeat(80));
  console.log(`ANALYSE: ${countryConfig.name.toUpperCase()}`);
  console.log(`Typ: ${countryConfig.description}`);
  console.log("=".repeat(80));

  const allElements = data.elements ?? [];
  console.log(`\n📊 Anzahl gefundener Wege (roh): ${allElements.length}`);

  if (allElements.length === 0) {
    console.log("❌ Keine Daten gefunden!");
    return null;
  }

  console.log(`\n🔍 Filtere Wege (Min: ${countryConfig.minLengthMeters}m, ${countryConfig.minDurationMinutes} Min)...`);
  console.log(`🚛 Fahrzeug: ${countryConfig.vehicleWidth}m breit, ${countryConfig.vehicleHeight}m hoch, ${countryConfig.vehicleWeight}t`);
  
  const { filtered: elements, rejected } = filterWays(
    allElements,
    countryConfig,
    countryConfig.queryType
  );

  console.log(`✅ ${elements.length} Wege erfüllen die Kriterien`);
  console.log(`❌ ${rejected.length} Wege ausgeschlossen\n`);

  if (rejected.length > 0 && rejected.length <= 10) {
    console.log("📋 Ausgeschlossene Wege (Beispiele):");
    rejected.slice(0, 5).forEach((r) => {
      console.log(`   - OSM ${r.id}: ${r.lengthM}m, ~${r.durationMin} Min`);
      console.log(`     ❌ ${r.reason}`);
    });
    console.log("");
  }

  if (elements.length === 0) {
    console.log("❌ Keine Wege erfüllen die Kriterien!");
    return null;
  }

  // Statistiken
  let totalLength = 0;
  let totalDuration = 0;
  const sampleWays = [];

  elements.forEach((el, idx) => {
    const tags = el.tags || {};
    const length = wayLengthMeters(el.geometry);
    const score = estimateDifficultyScore(tags, countryConfig.queryType);
    const avgSpeed = countryConfig.queryType === 'scenic_roads' ? 50 : (score <= 30 ? 40 : score <= 60 ? 25 : 15);
    const duration = (length / 1000 / avgSpeed) * 60;

    totalLength += length;
    totalDuration += duration;

    if (idx < 5) {
      sampleWays.push({
        id: el.id,
        tags: tags,
        length_km: (length / 1000).toFixed(3),
        duration_min: duration.toFixed(1),
        score: score,
        firstCoord: el.geometry?.[0],
        lastCoord: el.geometry?.[el.geometry.length - 1],
      });
    }
  });

  console.log(`\n📏 Gesamtlänge: ${(totalLength / 1000).toFixed(2)} km`);
  console.log(`⏱️  Gesamt-Fahrzeit: ${(totalDuration / 60).toFixed(1)}h (${Math.round(totalDuration)} Min)`);
  console.log(`📏 Ø Länge pro Weg: ${(totalLength / elements.length / 1000).toFixed(2)} km`);
  console.log(`⏱️  Ø Fahrzeit pro Weg: ${(totalDuration / elements.length).toFixed(1)} Min`);

  console.log("\n📋 BEISPIEL-WEGE (erste 5):");
  console.log("─".repeat(80));
  sampleWays.forEach((way, idx) => {
    console.log(`\n${idx + 1}. OSM-ID: ${way.id}`);
    console.log(`   Länge: ${way.length_km} km (~${way.duration_min} Min)`);
    console.log(`   Typ: ${way.tags.highway || "N/A"}`);
    console.log(`   Surface: ${way.tags.surface || "N/A"}`);
    console.log(`   Name: ${way.tags.name || "Unbenannt"}`);
    
    if (countryConfig.queryType === 'offroad_tracks') {
      console.log(`   Tracktype: ${way.tags.tracktype || "N/A"}`);
      console.log(`   Schwierigkeit: ${way.score}/100`);
    } else {
      console.log(`   Maxspeed: ${way.tags.maxspeed || "N/A"} km/h`);
      console.log(`   Lanes: ${way.tags.lanes || "N/A"}`);
    }
    
    console.log(`   OSM-Link: https://www.openstreetmap.org/way/${way.id}`);
  });

  return { totalLength, totalDuration, count: elements.length };
}

// Hauptfunktion
async function testCountry(countryCode, radius = 25000) {
  const config = COUNTRY_CONFIGS[countryCode];
  
  if (!config) {
    console.error(`❌ Unbekanntes Land: ${countryCode}`);
    console.log(`Verfügbare Länder: ${Object.keys(COUNTRY_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const query = QUERY_TEMPLATES[config.queryType](config.center.lat, config.center.lon, radius);

  console.log(`\n🚀 Starte Overpass-API Test`);
  console.log(`🌍 Land: ${config.name}`);
  console.log(`📍 Zentrum: ${config.center.lat}, ${config.center.lon}`);
  console.log(`🔍 Radius: ${radius / 1000} km`);
  console.log(`📝 Typ: ${config.description}`);
  console.log(`⏱️  Bitte warten...\n`);

  const startTime = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt];
    console.log(`🌐 Versuche Endpoint ${attempt + 1}/${OVERPASS_ENDPOINTS.length}`);

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
          console.warn(`   Server überlastet, versuche nächsten...\n`);
          lastError = `${res.status}: Server überlastet`;
          continue;
        }
        console.error(errorText);
        process.exit(1);
      }

      console.log(`✅ API-Antwort erhalten (${duration}s)`);

      const data = await res.json();

      const rawFilename = `overpass-${countryCode}-${Date.now()}.json`;
      fs.writeFileSync(rawFilename, JSON.stringify(data, null, 2));
      console.log(`💾 Rohdaten: ${rawFilename}`);

      const stats = analyzeData(data, config);

      if (stats) {
        const statsFilename = `overpass-${countryCode}-stats-${Date.now()}.json`;
        fs.writeFileSync(statsFilename, JSON.stringify(stats, null, 2));
        console.log(`\n💾 Statistiken: ${statsFilename}`);
      }

      console.log("\n" + "=".repeat(80));
      console.log("✅ TEST ABGESCHLOSSEN");
      console.log("=".repeat(80));
      console.log(`\n💡 ${config.name}: ${config.description}`);
      console.log("\n");
      return;

    } catch (error) {
      console.warn(`⚠️  Endpoint ${attempt + 1} Fehler: ${error.message}`);
      lastError = error.message;
      if (attempt < OVERPASS_ENDPOINTS.length - 1) {
        console.warn(`   Versuche nächsten...\n`);
        continue;
      }
    }
  }

  console.error("\n❌ Alle Endpoints fehlgeschlagen!");
  console.error(`Letzter Fehler: ${lastError}`);
  process.exit(1);
}

// Script ausführen
const countryCode = process.argv[2] || "germany";
const radius = parseInt(process.argv[3]) || 25000;

testCountry(countryCode, radius);
