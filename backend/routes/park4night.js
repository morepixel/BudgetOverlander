// Park4Night Routes
import express from 'express';
import { searchPark4Night } from '../utils/park4night-fetcher.js';

const router = express.Router();

// GET /api/park4night/places
router.get('/places', async (req, res) => {
  try {
    const { latitude, longitude, freeOnly } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude und Longitude erforderlich' });
    }
    
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const free = freeOnly === 'true';
    
    const places = await searchPark4Night(lat, lon, { freeOnly: free });
    
    res.json({ places });
    
  } catch (error) {
    console.error('Park4Night API error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
