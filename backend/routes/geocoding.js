// Geocoding Routes
import express from 'express';
import { geocodeAddress, reverseGeocode } from '../utils/geocoding.js';

const router = express.Router();

// GET /api/geocoding/search?q=München
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Suchbegriff erforderlich' });
    }
    
    const results = await geocodeAddress(q);
    res.json({ results });
    
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding fehlgeschlagen' });
  }
});

// GET /api/geocoding/reverse?lat=48.1351&lon=11.5820
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat und Lon erforderlich' });
    }
    
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    res.json({ result });
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Reverse geocoding fehlgeschlagen' });
  }
});

export default router;
