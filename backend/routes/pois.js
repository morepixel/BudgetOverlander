// POIs Routes - Points of Interest
import express from 'express';
import { fetchPOIsNearPoint, fetchPOIsAlongRoute } from '../utils/poi-fetcher.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GET /api/pois/near?lat=42.8&lon=0.5&radius=50&types=water,camping
router.get('/near', async (req, res) => {
  try {
    const { lat, lon, radius = 50, types = 'water,disposal,camping' } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat und Lon erforderlich' });
    }
    
    const typeArray = types.split(',');
    const pois = await fetchPOIsNearPoint(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      typeArray
    );
    
    res.json({ pois });
  } catch (error) {
    console.error('POI fetch error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der POIs' });
  }
});

// POST /api/pois/route - POIs entlang Route
router.post('/route', async (req, res) => {
  try {
    const { region, clusterIds, radius = 20, types = ['water', 'disposal', 'camping'] } = req.body;
    
    if (!region || !clusterIds || clusterIds.length === 0) {
      return res.status(400).json({ error: 'Region und Cluster-IDs erforderlich' });
    }
    
    // Lade Region-Daten
    const dataFiles = fs.readdirSync(join(__dirname, '..', '..'))
      .filter(f => f.startsWith(`region-${region}-`) && f.endsWith('.json'));
    
    if (dataFiles.length === 0) {
      return res.status(404).json({ error: 'Region-Daten nicht gefunden' });
    }
    
    const dataPath = join(__dirname, '..', '..', dataFiles[0]);
    const regionData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Filtere ausgewählte Cluster
    const selectedClusters = regionData.clusters.filter(c => clusterIds.includes(c.id));
    
    if (selectedClusters.length === 0) {
      return res.status(404).json({ error: 'Keine Cluster gefunden' });
    }
    
    // Lade POIs
    const pois = await fetchPOIsAlongRoute(selectedClusters, radius, types);
    
    res.json({ pois });
  } catch (error) {
    console.error('POI route error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der POIs' });
  }
});

export default router;
