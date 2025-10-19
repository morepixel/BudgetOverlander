// Accommodations Routes - Wohnmobilstellplätze
import express from 'express';
import pool from '../database/db-postgres.js';
import { searchAccommodations, saveAccommodation } from '../utils/accommodation-fetcher.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/accommodations/search - Stellplätze suchen
router.get('/search', async (req, res) => {
  try {
    const { lat, lon, radius = 50, maxPrice, freeOnly } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat und Lon erforderlich' });
    }
    
    const options = {
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      freeOnly: freeOnly === 'true'
    };
    
    // Suche in OSM
    const accommodations = await searchAccommodations(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      options
    );
    
    // Speichere neue Stellplätze in DB (async, ohne zu warten)
    accommodations.forEach(acc => {
      saveAccommodation(pool, acc).catch(err => {
        console.error('Error saving accommodation:', err);
      });
    });
    
    // Hole User-Bewertungen aus DB
    for (const acc of accommodations) {
      try {
        const dbResult = await pool.query(
          'SELECT id, rating FROM accommodations WHERE osm_id = $1',
          [acc.osm_id]
        );
        
        if (dbResult.rows.length > 0) {
          acc.db_id = dbResult.rows[0].id;
          acc.rating = dbResult.rows[0].rating;
        }
      } catch (err) {
        // Ignoriere DB-Fehler
      }
    }
    
    res.json({ accommodations });
  } catch (error) {
    console.error('Accommodation search error:', error);
    res.status(500).json({ error: 'Fehler bei der Suche' });
  }
});

// GET /api/accommodations/:id - Einzelner Stellplatz
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const result = await pool.query(
      'SELECT * FROM accommodations WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stellplatz nicht gefunden' });
    }
    
    const accommodation = result.rows[0];
    
    // Hole Bewertungen
    const reviewsResult = await pool.query(
      `SELECT r.*, u.name as user_name 
       FROM accommodation_reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.accommodation_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );
    
    accommodation.reviews = reviewsResult.rows;
    
    res.json({ accommodation });
  } catch (error) {
    console.error('Get accommodation error:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /api/accommodations/:id/review - Bewertung hinzufügen
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const accommodationId = parseInt(req.params.id);
    const { rating, comment, visitedDate } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating muss zwischen 1 und 5 liegen' });
    }
    
    await pool.query(
      `INSERT INTO accommodation_reviews (accommodation_id, user_id, rating, comment, visited_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (accommodation_id, user_id) 
       DO UPDATE SET rating = $3, comment = $4, visited_date = $5`,
      [accommodationId, req.user.userId, rating, comment, visitedDate]
    );
    
    res.json({ message: 'Bewertung gespeichert' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Bewertung' });
  }
});

// GET /api/accommodations/nearby/route - Stellplätze entlang Route
router.post('/nearby/route', async (req, res) => {
  try {
    const { route, radius = 20, maxPrice, freeOnly } = req.body;
    
    if (!route || !route.coordinates || route.coordinates.length === 0) {
      return res.status(400).json({ error: 'Route erforderlich' });
    }
    
    // Nimm jeden 10. Punkt der Route für die Suche
    const samplePoints = route.coordinates.filter((_, i) => i % 10 === 0);
    
    const allAccommodations = new Map();
    
    // Suche Stellplätze an jedem Sample-Punkt
    for (const coord of samplePoints) {
      const [lon, lat] = coord;
      
      const accommodations = await searchAccommodations(
        lat,
        lon,
        radius,
        { maxPrice: maxPrice ? parseFloat(maxPrice) : null, freeOnly }
      );
      
      // Dedupliziere anhand osm_id
      accommodations.forEach(acc => {
        if (!allAccommodations.has(acc.osm_id)) {
          allAccommodations.set(acc.osm_id, acc);
        }
      });
    }
    
    const uniqueAccommodations = Array.from(allAccommodations.values());
    
    res.json({ 
      accommodations: uniqueAccommodations.slice(0, 50) // Max 50
    });
  } catch (error) {
    console.error('Route accommodations error:', error);
    res.status(500).json({ error: 'Fehler bei der Suche' });
  }
});

export default router;
