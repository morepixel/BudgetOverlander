// Photos API Routes
import express from 'express';
import { findPhotosNearLocation } from '../utils/flickr-photos.js';

const router = express.Router();

/**
 * GET /api/photos/nearby
 * Suche Fotos in der Nähe eines Standorts
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radius = 1, limit = 3 } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat und lon sind erforderlich' });
    }
    
    const photos = await findPhotosNearLocation(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      parseInt(limit)
    );
    
    res.json({
      success: true,
      count: photos.length,
      photos
    });
  } catch (error) {
    console.error('Photos API error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Fotos' });
  }
});

export default router;
