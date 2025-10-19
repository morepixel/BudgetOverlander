// Regions Routes - Hole verfügbare Regionen und deren Cluster
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verfügbare Regionen
const REGIONS = {
  pyrenees: {
    id: 'pyrenees',
    name: 'Pyrenäen',
    description: 'Französisch-Spanische Pyrenäen',
    country: 'Frankreich/Spanien',
    dataFile: 'region-pyrenees-1760452290235.json'
  },
  sierra_nevada: {
    id: 'sierra_nevada',
    name: 'Sierra Nevada',
    description: 'Andalusien, Spanien',
    country: 'Spanien',
    dataFile: 'region-sierra_nevada-*.json'
  },
  alps_south: {
    id: 'alps_south',
    name: 'Südalpen',
    description: 'Französische & Italienische Südalpen',
    country: 'Frankreich/Italien',
    dataFile: 'region-alps_south-*.json'
  },
  norway_south: {
    id: 'norway_south',
    name: 'Südnorwegen',
    description: 'Hardangervidda & Umgebung',
    country: 'Norwegen',
    dataFile: 'region-norway_south-*.json'
  }
};

// GET /api/regions - Liste aller Regionen
router.get('/', (req, res) => {
  const regionList = Object.values(REGIONS).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    country: r.country
  }));
  
  res.json({ regions: regionList });
});

// GET /api/regions/:id - Details einer Region
router.get('/:id', (req, res) => {
  const regionId = req.params.id;
  const region = REGIONS[regionId];
  
  if (!region) {
    return res.status(404).json({ error: 'Region nicht gefunden' });
  }
  
  res.json(region);
});

// GET /api/regions/:id/clusters - Cluster einer Region
router.get('/:id/clusters', (req, res) => {
  try {
    const regionId = req.params.id;
    const region = REGIONS[regionId];
    
    if (!region) {
      return res.status(404).json({ error: 'Region nicht gefunden' });
    }
    
    // Lade Region-Daten aus Root-Verzeichnis
    const dataPath = join(__dirname, '..', '..', region.dataFile);
    
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ 
        error: 'Region-Daten nicht gefunden',
        hint: `Führe aus: node collect-region-tracks.js ${regionId}`
      });
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Sende nur relevante Cluster-Infos (nicht alle Track-Details)
    const clusters = data.clusters.map(c => ({
      id: c.id,
      center: c.center,
      bbox: c.bbox,
      trackCount: c.trackCount,
      totalLength: c.totalLength,
      avgDifficulty: c.avgDifficulty,
      nearestTown: c.nearestTown
    }));
    
    res.json({
      region: data.region,
      stats: data.stats,
      clusters: clusters
    });
  } catch (error) {
    console.error('Error loading clusters:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Cluster' });
  }
});

export default router;
