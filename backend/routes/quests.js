// Quests Routes - TrailQuest Game Mechanics
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/quests/nearby - Quests in der Nähe
router.get('/nearby', authenticateToken, async (req, res) => {
  try {
    const { lat, lon, radius = 50 } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat und Lon erforderlich' });
    }
    
    const result = await pool.query(`
      SELECT 
        q.id,
        q.name,
        q.description,
        q.type,
        q.lat,
        q.lon,
        q.reward_xp,
        q.difficulty,
        q.region,
        COALESCE(up.status, 'pending') as status,
        up.progress,
        up.completed_at,
        SQRT(POW(69.1 * (q.lat - $2), 2) + POW(69.1 * ($3 - q.lon) * COS(q.lat / 57.3), 2)) as distance_miles
      FROM quests q
      LEFT JOIN user_progress up ON q.id = up.quest_id AND up.user_id = $1
      WHERE q.lat IS NOT NULL AND q.lon IS NOT NULL
        AND SQRT(POW(69.1 * (q.lat - $2), 2) + POW(69.1 * ($3 - q.lon) * COS(q.lat / 57.3), 2)) <= ($4 * 0.621371)
      ORDER BY distance_miles
      LIMIT 20
    `, [req.user.userId, lat, lon, radius]);
    
    res.json({ quests: result.rows });
  } catch (error) {
    console.error('Get nearby quests error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Quests' });
  }
});

// GET /api/quests/region/:region - Quests nach Region
router.get('/region/:region', authenticateToken, async (req, res) => {
  try {
    const { region } = req.params;
    
    const result = await pool.query(`
      SELECT 
        q.id,
        q.name,
        q.description,
        q.type,
        q.lat,
        q.lon,
        q.reward_xp,
        q.difficulty,
        q.region,
        COALESCE(up.status, 'pending') as status,
        up.progress,
        up.completed_at
      FROM quests q
      LEFT JOIN user_progress up ON q.id = up.quest_id AND up.user_id = $1
      WHERE q.region = $2
      ORDER BY q.reward_xp DESC
    `, [req.user.userId, region]);
    
    res.json({ quests: result.rows });
  } catch (error) {
    console.error('Get region quests error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Quests' });
  }
});

// POST /api/quests/:id/start - Quest starten
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    
    await pool.query(`
      INSERT INTO user_progress (user_id, quest_id, status)
      VALUES ($1, $2, 'in_progress')
      ON CONFLICT (user_id, quest_id) 
      DO UPDATE SET status = 'in_progress'
    `, [req.user.userId, questId]);
    
    res.json({ message: 'Quest gestartet' });
  } catch (error) {
    console.error('Start quest error:', error);
    res.status(500).json({ error: 'Fehler beim Starten der Quest' });
  }
});

// POST /api/quests/:id/complete - Quest abschließen
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Quest als completed markieren
      await client.query(`
        INSERT INTO user_progress (user_id, quest_id, status, progress, completed_at)
        VALUES ($1, $2, 'completed', 100, NOW())
        ON CONFLICT (user_id, quest_id) 
        DO UPDATE SET status = 'completed', progress = 100, completed_at = NOW()
      `, [req.user.userId, questId]);
      
      // XP holen
      const questResult = await client.query(
        'SELECT reward_xp FROM quests WHERE id = $1',
        [questId]
      );
      
      if (questResult.rows.length === 0) {
        throw new Error('Quest nicht gefunden');
      }
      
      const rewardXp = questResult.rows[0].reward_xp;
      
      // XP zum User hinzufügen
      const userResult = await client.query(`
        UPDATE users 
        SET xp = xp + $1, updated_at = NOW()
        WHERE id = $2
        RETURNING xp, level
      `, [rewardXp, req.user.userId]);
      
      // User stats aktualisieren
      await client.query(`
        UPDATE user_stats
        SET total_quests_completed = total_quests_completed + 1,
            updated_at = NOW()
        WHERE user_id = $1
      `, [req.user.userId]);
      
      await client.query('COMMIT');
      
      const newXp = userResult.rows[0].xp;
      const newLevel = userResult.rows[0].level;
      
      res.json({
        message: 'Quest abgeschlossen!',
        reward_xp: rewardXp,
        total_xp: newXp,
        level: newLevel
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Complete quest error:', error);
    res.status(500).json({ error: 'Fehler beim Abschließen der Quest' });
  }
});

// GET /api/quests/progress - User's Quest-Fortschritt
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        q.id,
        q.name,
        q.type,
        q.reward_xp,
        up.status,
        up.progress,
        up.completed_at
      FROM user_progress up
      JOIN quests q ON up.quest_id = q.id
      WHERE up.user_id = $1
      ORDER BY up.completed_at DESC NULLS FIRST
    `, [req.user.userId]);
    
    res.json({ progress: result.rows });
  } catch (error) {
    console.error('Get quest progress error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Fortschritts' });
  }
});

export default router;
