// Import Germany Offroad & Scenic Data from Overpass API
import fetch from 'node-fetch';
import pool from '../database/db-postgres.js';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Germany split into regions to avoid Overpass size limits
const GERMANY_REGIONS = [
  { name: 'Nord', bbox: [53.0, 7.0, 55.1, 15.1] },
  { name: 'Nordwest', bbox: [51.0, 5.8, 53.0, 9.0] },
  { name: 'Nordost', bbox: [51.0, 9.0, 53.0, 15.1] },
  { name: 'Mitte-West', bbox: [49.0, 5.8, 51.0, 9.0] },
  { name: 'Mitte-Ost', bbox: [49.0, 9.0, 51.0, 15.1] },
  { name: 'Süd-West', bbox: [47.2, 5.8, 49.0, 9.0] },
  { name: 'Süd-Ost', bbox: [47.2, 9.0, 49.0, 15.1] }
];

/**
 * Import Offroad Tracks for Germany (region by region)
 */
async function importOffroadTracks() {
  console.log('🚙 Importiere Offroad-Tracks für Deutschland (7 Regionen)...');
  
  let totalImported = 0;
  
  for (const region of GERMANY_REGIONS) {
    console.log(`\n📍 Region: ${region.name}`);
    
    const query = `
[out:json][timeout:300][bbox:${region.bbox.join(',')}];
(
  way["highway"~"^(track|path)$"]
     ["surface"~"^(gravel|dirt|ground|unpaved|fine_gravel|compacted)$"]
     ["access"!~"^(private|no)$"]
     ["motor_vehicle"!~"^(no|private)$"];
);
out geom;
`;

    try {
      const response = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }).toString(),
      });

      if (!response.ok) {
        console.error(`❌ Overpass API error für ${region.name}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`📦 ${data.elements.length} Offroad-Tracks gefunden`);

      let imported = 0;
      for (const element of data.elements) {
        if (!element.geometry || element.geometry.length < 2) continue;

        const tags = element.tags || {};
        const coords = element.geometry.map(p => ({ lat: p.lat, lon: p.lon }));
        
        // Calculate center point
        const centerLat = element.geometry.reduce((sum, p) => sum + p.lat, 0) / element.geometry.length;
        const centerLon = element.geometry.reduce((sum, p) => sum + p.lon, 0) / element.geometry.length;
        
        // Calculate length
        const length = calculateLength(element.geometry);
        
        // Calculate difficulty
        const difficulty = calculateDifficulty(tags);

        try {
          await pool.query(
            `INSERT INTO germany_offroad_tracks (osm_id, name, highway, surface, tracktype, difficulty, length_km, center_lat, center_lon, geometry_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (osm_id) DO NOTHING`,
            [
              element.id,
              tags.name || null,
              tags.highway,
              tags.surface,
              tags.tracktype || null,
              difficulty,
              length,
              centerLat,
              centerLon,
              JSON.stringify(coords)
            ]
          );
          imported++;
        } catch (error) {
          console.error(`Fehler bei Track ${element.id}:`, error.message);
        }
      }

      console.log(`✅ ${imported} Offroad-Tracks in ${region.name} importiert`);
      totalImported += imported;
      
      // Wait between regions to respect rate limits
      if (region !== GERMANY_REGIONS[GERMANY_REGIONS.length - 1]) {
        console.log('⏳ Warte 10 Sekunden...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (error) {
      console.error(`❌ Fehler beim Import von ${region.name}:`, error.message);
    }
  }
  
  console.log(`\n✅ GESAMT: ${totalImported} Offroad-Tracks importiert`);
  
  // Update metadata
  try {
    await pool.query(
      `INSERT INTO germany_data_metadata (data_type, total_records, source)
       VALUES ('offroad_tracks', $1, 'Overpass API')`,
      [totalImported]
    );
  } catch (error) {
    console.error('Metadata update error:', error);
  }
}

/**
 * Import Scenic Viewpoints for Germany
 */
async function importViewpoints() {
  console.log('📸 Importiere Aussichtspunkte für Deutschland...');
  
  const query = `
[out:json][timeout:300][bbox:${GERMANY_BBOX.join(',')}];
(
  node["tourism"="viewpoint"];
);
out;
`;

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📦 ${data.elements.length} Aussichtspunkte gefunden`);

    let imported = 0;
    for (const element of data.elements) {
      const tags = element.tags || {};

      try {
        await pool.query(
          `INSERT INTO germany_viewpoints (osm_id, name, elevation, description, lat, lon)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (osm_id) DO NOTHING`,
          [
            element.id,
            tags.name || 'Aussichtspunkt',
            tags.ele ? parseInt(tags.ele) : null,
            tags.description || null,
            element.lat,
            element.lon
          ]
        );
        imported++;
      } catch (error) {
        console.error(`Fehler bei Viewpoint ${element.id}:`, error.message);
      }
    }

    console.log(`✅ ${imported} Aussichtspunkte importiert`);
    
    await pool.query(
      `INSERT INTO germany_data_metadata (data_type, total_records, source)
       VALUES ('viewpoints', $1, 'Overpass API')`,
      [imported]
    );
    
  } catch (error) {
    console.error('❌ Fehler beim Import von Aussichtspunkten:', error);
  }
}

/**
 * Import Scenic Roads for Germany
 */
async function importScenicRoads() {
  console.log('🌄 Importiere Panoramastraßen für Deutschland...');
  
  const query = `
[out:json][timeout:300][bbox:${GERMANY_BBOX.join(',')}];
(
  way["scenic"="yes"];
  way["scenic_value"];
);
out geom;
`;

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📦 ${data.elements.length} Panoramastraßen gefunden`);

    let imported = 0;
    for (const element of data.elements) {
      if (!element.geometry || element.geometry.length < 2) continue;

      const tags = element.tags || {};
      const coords = element.geometry.map(p => ({ lat: p.lat, lon: p.lon }));
      
      // Calculate center point
      const centerLat = element.geometry.reduce((sum, p) => sum + p.lat, 0) / element.geometry.length;
      const centerLon = element.geometry.reduce((sum, p) => sum + p.lon, 0) / element.geometry.length;
      
      const length = calculateLength(element.geometry);

      try {
        await pool.query(
          `INSERT INTO germany_scenic_roads (osm_id, name, scenic_value, highway, length_km, center_lat, center_lon, geometry_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (osm_id) DO NOTHING`,
          [
            element.id,
            tags.name || 'Panoramastraße',
            tags.scenic_value || 'yes',
            tags.highway || null,
            length,
            centerLat,
            centerLon,
            JSON.stringify(coords)
          ]
        );
        imported++;
      } catch (error) {
        console.error(`Fehler bei Scenic Road ${element.id}:`, error.message);
      }
    }

    console.log(`✅ ${imported} Panoramastraßen importiert`);
    
    await pool.query(
      `INSERT INTO germany_data_metadata (data_type, total_records, source)
       VALUES ('scenic_roads', $1, 'Overpass API')`,
      [imported]
    );
    
  } catch (error) {
    console.error('❌ Fehler beim Import von Panoramastraßen:', error);
  }
}

/**
 * Import Natural Parks for Germany
 */
async function importNaturalParks() {
  console.log('🏞️ Importiere Nationalparks für Deutschland...');
  
  const query = `
[out:json][timeout:300][bbox:${GERMANY_BBOX.join(',')}];
(
  way["boundary"="national_park"];
  relation["boundary"="national_park"];
  way["leisure"="nature_reserve"];
  relation["leisure"="nature_reserve"];
);
out center;
`;

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📦 ${data.elements.length} Parks/Schutzgebiete gefunden`);

    let imported = 0;
    for (const element of data.elements) {
      const tags = element.tags || {};
      const center = element.center || { lat: element.lat, lon: element.lon };
      
      if (!center.lat || !center.lon) continue;

      const parkType = tags.boundary === 'national_park' ? 'national_park' : 'nature_reserve';

      try {
        await pool.query(
          `INSERT INTO germany_natural_parks (osm_id, name, park_type, description, lat, lon)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (osm_id) DO NOTHING`,
          [
            element.id,
            tags.name || (parkType === 'national_park' ? 'Nationalpark' : 'Naturschutzgebiet'),
            parkType,
            tags.description || null,
            center.lat,
            center.lon
          ]
        );
        imported++;
      } catch (error) {
        console.error(`Fehler bei Park ${element.id}:`, error.message);
      }
    }

    console.log(`✅ ${imported} Parks/Schutzgebiete importiert`);
    
    await pool.query(
      `INSERT INTO germany_data_metadata (data_type, total_records, source)
       VALUES ('natural_parks', $1, 'Overpass API')`,
      [imported]
    );
    
  } catch (error) {
    console.error('❌ Fehler beim Import von Parks:', error);
  }
}

/**
 * Calculate track length in km
 */
function calculateLength(geometry) {
  let totalLength = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    const p1 = geometry[i];
    const p2 = geometry[i + 1];
    totalLength += haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  }
  return totalLength;
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
 * Calculate difficulty score
 */
function calculateDifficulty(tags) {
  let difficulty = 1;
  
  if (tags.surface === 'dirt' || tags.surface === 'ground') difficulty += 2;
  else if (tags.surface === 'gravel') difficulty += 1;
  
  if (tags.tracktype === 'grade4' || tags.tracktype === 'grade5') difficulty += 2;
  else if (tags.tracktype === 'grade3') difficulty += 1;
  
  if (tags.smoothness === 'very_bad' || tags.smoothness === 'horrible') difficulty += 2;
  else if (tags.smoothness === 'bad') difficulty += 1;
  
  return Math.min(difficulty, 5);
}

/**
 * Main import function
 */
async function main() {
  console.log('🇩🇪 Starte Deutschland-Datenimport...\n');
  
  try {
    await importOffroadTracks();
    console.log('\n⏳ Warte 60 Sekunden (Overpass Rate Limit)...\n');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    await importViewpoints();
    console.log('\n⏳ Warte 60 Sekunden (Overpass Rate Limit)...\n');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    await importScenicRoads();
    console.log('\n⏳ Warte 60 Sekunden (Overpass Rate Limit)...\n');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    await importNaturalParks();
    
    console.log('\n✅ Deutschland-Datenimport abgeschlossen!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import fehlgeschlagen:', error);
    process.exit(1);
  }
}

main();
