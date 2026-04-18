import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Alle Alerts für User/Vehicle abrufen ─────────────────────────────────────
router.get('/:vehicleId', authenticateToken, async (req, res) => {
  const { vehicleId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM user_alerts 
       WHERE user_id = $1 AND vehicle_id = $2 
       ORDER BY resource_type, condition`,
      [req.user.userId, vehicleId]
    );
    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Alerts' });
  }
});

// ─── Alert erstellen/aktualisieren ────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const { vehicleId, resourceType, condition, thresholdValue, isEnabled, cooldownMinutes } = req.body;
  
  if (!vehicleId || !resourceType || !condition || thresholdValue === undefined) {
    return res.status(400).json({ error: 'vehicleId, resourceType, condition und thresholdValue sind erforderlich' });
  }
  
  try {
    // Prüfen ob Alert bereits existiert
    const existing = await pool.query(
      `SELECT id FROM user_alerts 
       WHERE user_id = $1 AND vehicle_id = $2 AND resource_type = $3 AND condition = $4`,
      [req.user.userId, vehicleId, resourceType, condition]
    );
    
    if (existing.rows.length > 0) {
      // Update
      const result = await pool.query(
        `UPDATE user_alerts 
         SET threshold_value = $1, is_enabled = $2, cooldown_minutes = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [thresholdValue, isEnabled !== false, cooldownMinutes || 60, existing.rows[0].id]
      );
      return res.json({ alert: result.rows[0], updated: true });
    }
    
    // Neu erstellen
    const result = await pool.query(
      `INSERT INTO user_alerts (user_id, vehicle_id, resource_type, condition, threshold_value, is_enabled, cooldown_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.userId, vehicleId, resourceType, condition, thresholdValue, isEnabled !== false, cooldownMinutes || 60]
    );
    res.json({ alert: result.rows[0], created: true });
  } catch (error) {
    console.error('Create/update alert error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Alerts' });
  }
});

// ─── Alert löschen ────────────────────────────────────────────────────────────
router.delete('/:alertId', authenticateToken, async (req, res) => {
  const { alertId } = req.params;
  try {
    await pool.query(
      'DELETE FROM user_alerts WHERE id = $1 AND user_id = $2',
      [alertId, req.user.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Alerts' });
  }
});

// ─── Alert aktivieren/deaktivieren ────────────────────────────────────────────
router.patch('/:alertId/toggle', authenticateToken, async (req, res) => {
  const { alertId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE user_alerts 
       SET is_enabled = NOT is_enabled, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [alertId, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert nicht gefunden' });
    }
    res.json({ alert: result.rows[0] });
  } catch (error) {
    console.error('Toggle alert error:', error);
    res.status(500).json({ error: 'Fehler beim Umschalten des Alerts' });
  }
});

// ─── Push-Subscription registrieren ───────────────────────────────────────────
router.post('/push/subscribe', authenticateToken, async (req, res) => {
  const { playerId, deviceType } = req.body;
  
  if (!playerId) {
    return res.status(400).json({ error: 'playerId ist erforderlich' });
  }
  
  try {
    // Prüfen ob bereits registriert
    const existing = await pool.query(
      'SELECT id FROM push_subscriptions WHERE user_id = $1 AND onesignal_player_id = $2',
      [req.user.userId, playerId]
    );
    
    if (existing.rows.length > 0) {
      // Update
      await pool.query(
        `UPDATE push_subscriptions 
         SET is_active = true, device_type = $1, updated_at = NOW()
         WHERE id = $2`,
        [deviceType || 'unknown', existing.rows[0].id]
      );
    } else {
      // Neu erstellen
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, onesignal_player_id, device_type)
         VALUES ($1, $2, $3)`,
        [req.user.userId, playerId, deviceType || 'unknown']
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Fehler beim Registrieren der Push-Subscription' });
  }
});

// ─── Push-Subscription deaktivieren ───────────────────────────────────────────
router.post('/push/unsubscribe', authenticateToken, async (req, res) => {
  const { playerId } = req.body;
  
  try {
    await pool.query(
      `UPDATE push_subscriptions 
       SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND onesignal_player_id = $2`,
      [req.user.userId, playerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Fehler beim Deaktivieren der Push-Subscription' });
  }
});

export default router;
