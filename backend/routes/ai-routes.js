// AI Routes - KI-gestützte Routen-Empfehlungen
import express from 'express';
import { getAIRouteRecommendations, discoverPOIsAlongRoute, getRouteNarrative } from '../utils/ai-route-recommender.js';

const router = express.Router();

// POST /api/ai/route-recommendations
router.post('/route-recommendations', async (req, res) => {
  try {
    const { start, end, preferences } = req.body;
    
    if (!start) {
      return res.status(400).json({ error: 'Startpunkt erforderlich' });
    }
    
    // Im Discovery Mode ist end optional
    if (!preferences?.discoveryMode && !end) {
      return res.status(400).json({ error: 'Zielpunkt erforderlich (oder Discovery Mode aktivieren)' });
    }
    
    const result = await getAIRouteRecommendations(start, end, preferences);
    res.json(result);
    
  } catch (error) {
    console.error('AI route recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/discover-pois
router.post('/discover-pois', async (req, res) => {
  try {
    const { route, preferences } = req.body;
    
    if (!route) {
      return res.status(400).json({ error: 'Route erforderlich' });
    }
    
    const result = await discoverPOIsAlongRoute(route, preferences);
    res.json(result);
    
  } catch (error) {
    console.error('POI discovery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/route-narrative
router.post('/route-narrative', async (req, res) => {
  try {
    const { route } = req.body;
    
    if (!route) {
      return res.status(400).json({ error: 'Route erforderlich' });
    }
    
    const narrative = await getRouteNarrative(route);
    res.json({ narrative });
    
  } catch (error) {
    console.error('Route narrative error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
