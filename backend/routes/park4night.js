// Park4Night Proxy Routes
import express from 'express';
import { searchPark4Night } from '../utils/park4night-fetcher.js';

const router = express.Router();

// GET /api/park4night/places - Suche Plätze
router.get('/places', async (req, res) => {
  try {
    const { latitude, longitude, maxPrice, freeOnly } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude und Longitude erforderlich' });
    }
    
    const options = {
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      freeOnly: freeOnly === 'true'
    };
    
    const places = await searchPark4Night(parseFloat(latitude), parseFloat(longitude), options);
    
    res.json({ places, count: places.length });
    
  } catch (error) {
    console.error('Park4Night proxy error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Park4Night Daten' });
  }
});

export default router;
