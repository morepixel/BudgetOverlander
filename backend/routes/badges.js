// Badges Routes - TrailQuest Achievement System
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/badges - Alle Badges
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, icon, requirement, requirement_type, requirement_value
      FROM badges
      ORDER BY requirement_value ASC
    `);
    
    res.json({ badges: result.rows });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Badges' });
  }
});

// GET /api/badges/user - User's Badges
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.description,
        b.icon,
        b.requirement,
        ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = $1
      ORDER BY ub.earned_at DESC
    `, [req.user.userId]);
    
    res.json({ badges: result.rows });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Badges' });
  }
});

// GET /api/badges/progress - Badge-Fortschritt
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        total_distance_km,
        total_offroad_km,
        total_elevation_m,
        total_quests_completed,
        total_photos_uploaded
      FROM user_stats
      WHERE user_id = $1
    `, [req.user.userId]);
    
    const userResult = await pool.query(`
      SELECT xp FROM users WHERE id = $1
    `, [req.user.userId]);
    
    const stats = statsResult.rows[0] || {};
    const xp = userResult.rows[0]?.xp || 0;
    
    const badgesResult = await pool.query(`
      SELECT 
        b.id,
        b.name,
        b.description,
        b.icon,
        b.requirement,
        b.requirement_type,
        b.requirement_value,
        CASE 
          WHEN ub.badge_id IS NOT NULL THEN true
          ELSE false
        END as earned
      FROM badges b
      LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = $1
      ORDER BY b.requirement_value ASC
    `, [req.user.userId]);
    
    const progress = badgesResult.rows.map(badge => {
      let currentValue = 0;
      
      switch (badge.requirement_type) {
        case 'elevation':
          currentValue = stats.total_elevation_m || 0;
          break;
        case 'distance':
          currentValue = stats.total_offroad_km || 0;
          break;
        case 'quests':
          currentValue = stats.total_quests_completed || 0;
          break;
        case 'photos':
          currentValue = stats.total_photos_uploaded || 0;
          break;
        case 'xp':
          currentValue = xp;
          break;
      }
      
      return {
        ...badge,
        current_value: currentValue,
        progress_percent: Math.min(100, Math.round((currentValue / badge.requirement_value) * 100))
      };
    });
    
    res.json({ badges: progress });
  } catch (error) {
    console.error('Get badge progress error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Badge-Fortschritts' });
  }
});

export default router;
