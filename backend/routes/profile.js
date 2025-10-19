// Profile Routes - User Stats & Progress
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/profile - User-Profil mit Stats
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(`
      SELECT id, email, name, xp, level, created_at
      FROM users
      WHERE id = $1
    `, [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    
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
    
    const badgesResult = await pool.query(`
      SELECT COUNT(*) as badge_count
      FROM user_badges
      WHERE user_id = $1
    `, [req.user.userId]);
    
    const user = userResult.rows[0];
    const stats = statsResult.rows[0] || {
      total_distance_km: 0,
      total_offroad_km: 0,
      total_elevation_m: 0,
      total_quests_completed: 0,
      total_photos_uploaded: 0
    };
    
    // Berechne XP für nächstes Level
    const currentLevel = user.level;
    const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
    const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
    const xpProgress = user.xp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        level: user.level,
        xp_progress: xpProgress,
        xp_needed: xpNeeded,
        xp_percent: Math.round((xpProgress / xpNeeded) * 100),
        created_at: user.created_at
      },
      stats: {
        ...stats,
        badge_count: parseInt(badgesResult.rows[0].badge_count)
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Profils' });
  }
});

// POST /api/profile/update-stats - Stats aktualisieren (nach Route)
router.post('/update-stats', authenticateToken, async (req, res) => {
  try {
    const { distance_km, offroad_km, elevation_m } = req.body;
    
    await pool.query(`
      UPDATE user_stats
      SET 
        total_distance_km = total_distance_km + $1,
        total_offroad_km = total_offroad_km + $2,
        total_elevation_m = total_elevation_m + $3,
        updated_at = NOW()
      WHERE user_id = $4
    `, [distance_km || 0, offroad_km || 0, elevation_m || 0, req.user.userId]);
    
    res.json({ message: 'Stats aktualisiert' });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Stats' });
  }
});

// GET /api/profile/leaderboard - Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'xp', limit = 10 } = req.query;
    
    let orderBy = 'u.xp DESC';
    
    if (type === 'distance') {
      orderBy = 's.total_distance_km DESC';
    } else if (type === 'elevation') {
      orderBy = 's.total_elevation_m DESC';
    } else if (type === 'quests') {
      orderBy = 's.total_quests_completed DESC';
    }
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.xp,
        u.level,
        s.total_distance_km,
        s.total_offroad_km,
        s.total_elevation_m,
        s.total_quests_completed,
        (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as badge_count
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      ORDER BY ${orderBy}
      LIMIT $1
    `, [limit]);
    
    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Leaderboards' });
  }
});

export default router;
