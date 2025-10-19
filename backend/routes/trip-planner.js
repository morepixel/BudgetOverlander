// Trip Planner Routes
import express from 'express';
import pool from '../database/db-postgres.js';
import { planTrip } from '../utils/trip-planner.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// POST /api/trip-planner/calculate - Berechne Multi-Day Trip
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { startLocation, endLocation, preferences } = req.body;
    
    if (!startLocation || !startLocation.lat || !startLocation.lon) {
      return res.status(400).json({ error: 'Start-Location erforderlich' });
    }
    
    if (!endLocation || !endLocation.lat || !endLocation.lon) {
      return res.status(400).json({ error: 'Ziel-Location erforderlich' });
    }
    
    // Plane Trip
    const tripPlan = await planTrip(startLocation, endLocation, preferences || {});
    
    res.json({ tripPlan });
  } catch (error) {
    console.error('Trip planning error:', error);
    res.status(500).json({ error: error.message || 'Fehler bei der Trip-Planung' });
  }
});

// POST /api/trip-planner/save - Speichere Trip-Plan
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { name, tripPlan } = req.body;
    
    if (!name || !tripPlan) {
      return res.status(400).json({ error: 'Name und Trip-Plan erforderlich' });
    }
    
    const result = await pool.query(
      `INSERT INTO trip_plans (
        user_id, name, start_location, end_location, 
        start_date, preferences, route_data, days,
        total_distance, total_duration, total_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        req.user.userId,
        name,
        JSON.stringify(tripPlan.start_location),
        JSON.stringify(tripPlan.end_location),
        tripPlan.start_date || new Date(),
        JSON.stringify(tripPlan.preferences || {}),
        JSON.stringify(tripPlan.route),
        JSON.stringify(tripPlan.days),
        tripPlan.totalDistance,
        tripPlan.totalDuration,
        tripPlan.totalCost
      ]
    );
    
    res.json({ 
      message: 'Trip-Plan gespeichert',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Save trip plan error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// GET /api/trip-planner/my-trips - Alle gespeicherten Trips
router.get('/my-trips', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, start_location, end_location, start_date,
              total_distance, total_duration, total_cost, created_at
       FROM trip_plans
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    
    res.json({ trips: result.rows });
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// GET /api/trip-planner/:id - Einzelner Trip-Plan
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const result = await pool.query(
      'SELECT * FROM trip_plans WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip-Plan nicht gefunden' });
    }
    
    res.json({ tripPlan: result.rows[0] });
  } catch (error) {
    console.error('Get trip plan error:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

export default router;
