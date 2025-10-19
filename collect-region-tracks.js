// Sammelt alle Offroad-Tracks in einer Region und clustert sie geografisch
// Für Multi-Day Routen-Planung

import fs from "node:fs";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

// Regionen-Definitionen
const REGIONS = {
  pyrenees: {
    name: "Pyrenäen",
    bbox: {
      south: 42.0,
      north: 43.5,
      west: -2.0,
      east: 3.0
    },
    description: "Französisch-Spanische Pyrenäen",
    country: "france/spain"
  },
  alps_south: {
    name: "Südalpen",
    bbox: {
      south: 44.0,
      north: 46.0,
      west: 5.5,
      east: 8.0
    },
    description: "Französische & Italienische Südalpen",
    country: "france/italy"
  },
  sierra_nevada: {
    name: "Sierra Nevada",
    bbox: {
      south: 36.8,
      north: 37.3,
      west: -3.5,
      east: -2.8
    },
    description: "Andalusien, Spanien",
    country: "spain"
  },
  norway_south: {
    name: "Südnorwegen",
    bbox: {
      south: 59.0,
      north: 61.5,
      west: 5.0,
      east: 9.0
    },
    description: "Hardangervidda & Umgebung",
    country: "norway"
  }
};

// Overpass-Query für Region
function buildRegionQuery(bbox) {
  return `
[out:json][timeout:300];
(
  way["highway"~"^(track|unclassified)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["tracktype"~"^(grade1|grade2|grade3)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"]
     (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out tags geom;
`;
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

// Berechne Zentrum eines Weges
function getWayCenter(geometry) {
  if (!geometry || geometry.length === 0) return null;
  const mid = Math.floor(geometry.length / 2);
  return {
    lat: geometry[mid].lat,
    lon: geometry[mid].lon
  };
}

// Schwierigkeits-Score
function calculateDifficulty(tags) {
  let score = 20;
  const surfaceScores = {
    'gravel': 15, 'ground': 25, 'dirt': 30, 'sand': 35, 'rock': 40, 'compacted': 10
  };
  score += surfaceScores[tags.surface] || 20;
  
  const tracktypeScores = {
    'grade1': 0, 'grade2': 10, 'grade3': 20
  };
  score += tracktypeScores[tags.tracktype] || 15;
  
  return Math.min(score, 100);
}

// Geografisches Clustering (einfacher K-Means ähnlicher Ansatz)
function clusterTracks(tracks, clusterRadius = 20000) {
  const clusters = [];
  const assigned = new Set();

  tracks.forEach((track, idx) => {
    if (assigned.has(idx)) return;

    // Neuer Cluster mit diesem Track als Seed
    const cluster = {
      id: `cluster_${clusters.length + 1}`,
      tracks: [track],
      center: track.center,
      totalLength: track.length,
      avgDifficulty: track.difficulty,
      bbox: {
        minLat: track.center.lat,
        maxLat: track.center.lat,
        minLon: track.center.lon,
        maxLon: track.center.lon
      }
    };

    assigned.add(idx);

    // Finde alle Tracks in der Nähe
    tracks.forEach((otherTrack, otherIdx) => {
      if (assigned.has(otherIdx)) return;

      const distance = haversine(
        track.center.lat,
        track.center.lon,
        otherTrack.center.lat,
        otherTrack.center.lon
      );

      if (distance <= clusterRadius) {
        cluster.tracks.push(otherTrack);
        cluster.totalLength += otherTrack.length;
        assigned.add(otherIdx);

        // Update Bounding Box
        cluster.bbox.minLat = Math.min(cluster.bbox.minLat, otherTrack.center.lat);
        cluster.bbox.maxLat = Math.max(cluster.bbox.maxLat, otherTrack.center.lat);
        cluster.bbox.minLon = Math.min(cluster.bbox.minLon, otherTrack.center.lon);
        cluster.bbox.maxLon = Math.max(cluster.bbox.maxLon, otherTrack.center.lon);
      }
    });

    // Berechne Cluster-Zentrum (Durchschnitt)
    const sumLat = cluster.tracks.reduce((sum, t) => sum + t.center.lat, 0);
    const sumLon = cluster.tracks.reduce((sum, t) => sum + t.center.lon, 0);
    cluster.center = {
      lat: sumLat / cluster.tracks.length,
      lon: sumLon / cluster.tracks.length
    };

    // Durchschnittliche Schwierigkeit
    const sumDiff = cluster.tracks.reduce((sum, t) => sum + t.difficulty, 0);
    cluster.avgDifficulty = Math.round(sumDiff / cluster.tracks.length);

    clusters.push(cluster);
  });

  // Sortiere Cluster nach Anzahl Tracks (größte zuerst)
  clusters.sort((a, b) => b.tracks.length - a.tracks.length);

  return clusters;
}

// Finde nächste Stadt (vereinfacht - nutzt nur Namen aus OSM)
function findNearestTown(cluster, allTracks) {
  // Suche nach benannten Wegen in der Nähe als Proxy für Orte
  const nearbyNames = new Set();
  
  cluster.tracks.forEach(track => {
    if (track.name && track.name !== "Unbenannt") {
      nearbyNames.add(track.name);
    }
  });

  return nearbyNames.size > 0 ? Array.from(nearbyNames)[0] : "Unbekannt";
}

// Hauptfunktion
async function collectRegionTracks(regionKey, clusterRadius = 20000) {
  const region = REGIONS[regionKey];
  
  if (!region) {
    console.error(`❌ Unbekannte Region: ${regionKey}`);
    console.log(`Verfügbare Regionen: ${Object.keys(REGIONS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🗺️  REGION: ${region.name}`);
  console.log(`📍 Gebiet: ${region.description}`);
  console.log(`📦 BBox: ${region.bbox.south},${region.bbox.west} → ${region.bbox.north},${region.bbox.east}`);
  console.log(`🔍 Cluster-Radius: ${clusterRadius / 1000} km`);
  console.log(`⏱️  Sammle Daten (kann 1-2 Min dauern)...\n`);

  const query = buildRegionQuery(region.bbox);
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

      console.log(`✅ Daten erhalten (${duration}s)\n`);

      const data = await res.json();
      const elements = data.elements || [];

      console.log("=".repeat(80));
      console.log(`📊 ANALYSE: ${region.name.toUpperCase()}`);
      console.log("=".repeat(80));
      console.log(`\n✅ ${elements.length} Offroad-Tracks gefunden`);

      if (elements.length === 0) {
        console.log("❌ Keine Tracks in dieser Region!");
        return;
      }

      // Verarbeite Tracks
      console.log(`\n🔄 Verarbeite Tracks...`);
      const tracks = elements
        .filter(el => el.type === 'way')
        .map(el => {
          const tags = el.tags || {};
          const length = wayLengthMeters(el.geometry);
          const center = getWayCenter(el.geometry);
          
          return {
            id: el.id,
            name: tags.name || "Unbenannt",
            length: length / 1000, // in km
            center: center,
            difficulty: calculateDifficulty(tags),
            surface: tags.surface,
            tracktype: tags.tracktype,
            tags: tags
          };
        })
        .filter(t => t.length >= 0.5); // Min 500m

      console.log(`✅ ${tracks.length} Tracks verarbeitet (>500m)`);

      // Clustering
      console.log(`\n🗂️  Erstelle Cluster (${clusterRadius / 1000}km Radius)...`);
      const clusters = clusterTracks(tracks, clusterRadius);
      
      console.log(`✅ ${clusters.length} Cluster gefunden\n`);

      // Statistiken
      const totalLength = tracks.reduce((sum, t) => sum + t.length, 0);
      const avgDifficulty = tracks.reduce((sum, t) => sum + t.difficulty, 0) / tracks.length;

      console.log("📊 GESAMT-STATISTIK:");
      console.log(`   Tracks: ${tracks.length}`);
      console.log(`   Gesamtlänge: ${totalLength.toFixed(1)} km`);
      console.log(`   Ø Länge: ${(totalLength / tracks.length).toFixed(2)} km`);
      console.log(`   Ø Schwierigkeit: ${avgDifficulty.toFixed(0)}/100`);
      console.log(`   Cluster: ${clusters.length}`);

      // Top 10 Cluster
      console.log("\n🏆 TOP 10 CLUSTER (nach Anzahl Tracks):");
      console.log("─".repeat(80));
      clusters.slice(0, 10).forEach((cluster, idx) => {
        const nearestTown = findNearestTown(cluster, tracks);
        console.log(`\n${idx + 1}. ${cluster.id}`);
        console.log(`   📍 Zentrum: ${cluster.center.lat.toFixed(4)}, ${cluster.center.lon.toFixed(4)}`);
        console.log(`   🛣️  Tracks: ${cluster.tracks.length}`);
        console.log(`   📏 Gesamt: ${cluster.totalLength.toFixed(1)} km`);
        console.log(`   ⚡ Schwierigkeit: ${cluster.avgDifficulty}/100`);
        console.log(`   🏘️  Nähe: ${nearestTown}`);
        console.log(`   🔗 OSM: https://www.openstreetmap.org/#map=13/${cluster.center.lat}/${cluster.center.lon}`);
      });

      // Speichere Ergebnisse
      const output = {
        region: region.name,
        bbox: region.bbox,
        collectedAt: new Date().toISOString(),
        stats: {
          totalTracks: tracks.length,
          totalLength: totalLength,
          avgLength: totalLength / tracks.length,
          avgDifficulty: avgDifficulty,
          clusterCount: clusters.length
        },
        clusters: clusters.map(c => ({
          id: c.id,
          center: c.center,
          bbox: c.bbox,
          trackCount: c.tracks.length,
          totalLength: c.totalLength,
          avgDifficulty: c.avgDifficulty,
          nearestTown: findNearestTown(c, tracks),
          trackIds: c.tracks.map(t => t.id)
        })),
        tracks: tracks
      };

      const filename = `region-${regionKey}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Daten gespeichert: ${filename}`);

      // GeoJSON für Visualisierung
      const geojson = {
        type: "FeatureCollection",
        features: clusters.map(c => ({
          type: "Feature",
          properties: {
            id: c.id,
            trackCount: c.tracks.length,
            totalLength: c.totalLength,
            avgDifficulty: c.avgDifficulty,
            nearestTown: findNearestTown(c, tracks)
          },
          geometry: {
            type: "Point",
            coordinates: [c.center.lon, c.center.lat]
          }
        }))
      };

      const geojsonFilename = `region-${regionKey}-clusters.geojson`;
      fs.writeFileSync(geojsonFilename, JSON.stringify(geojson, null, 2));
      console.log(`💾 GeoJSON gespeichert: ${geojsonFilename}`);

      console.log("\n" + "=".repeat(80));
      console.log("✅ FERTIG");
      console.log("=".repeat(80));
      console.log(`\n💡 Nächster Schritt: Öffne ${geojsonFilename} auf geojson.io`);
      console.log(`   → Visualisiere die Cluster auf einer Karte\n`);

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
const regionKey = process.argv[2] || "pyrenees";
const clusterRadius = parseInt(process.argv[3]) || 20000; // 20km

collectRegionTracks(regionKey, clusterRadius);
