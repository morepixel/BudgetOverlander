// Power Consumers Routes - Verbraucher für Batterie
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Auto-Migration: Tabelle erstellen falls nicht vorhanden
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS power_consumers (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(10) DEFAULT '⚡',
        consumption_ah DECIMAL(6,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ power_consumers table ready');
  } catch (err) {
    console.error('power_consumers migration error:', err.message);
  }
})();

// GET /api/consumers - Alle Verbraucher für ein Fahrzeug
router.get('/:vehicleId', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT * FROM power_consumers 
       WHERE vehicle_id = $1 AND user_id = $2 
       ORDER BY name`,
      [vehicleId, userId]
    );

    // Berechne Gesamtverbrauch aktiver Verbraucher
    const activeConsumers = result.rows.filter(c => c.is_active);
    const totalConsumption = activeConsumers.reduce((sum, c) => sum + parseFloat(c.consumption_ah), 0);

    res.json({
      consumers: result.rows,
      totalConsumption,
      activeCount: activeConsumers.length
    });
  } catch (error) {
    console.error('Get consumers error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Verbraucher' });
  }
});

// POST /api/consumers - Neuen Verbraucher anlegen
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { vehicleId, name, icon, consumptionAh, isActive } = req.body;

    if (!vehicleId || !name || consumptionAh === undefined) {
      return res.status(400).json({ error: 'vehicleId, name und consumptionAh erforderlich' });
    }

    const result = await pool.query(
      `INSERT INTO power_consumers (vehicle_id, user_id, name, icon, consumption_ah, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vehicleId, userId, name, icon || '⚡', consumptionAh, isActive !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create consumer error:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen des Verbrauchers' });
  }
});

// PUT /api/consumers/:id - Verbraucher aktualisieren
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, icon, consumptionAh, isActive } = req.body;

    const result = await pool.query(
      `UPDATE power_consumers 
       SET name = COALESCE($1, name),
           icon = COALESCE($2, icon),
           consumption_ah = COALESCE($3, consumption_ah),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, icon, consumptionAh, isActive, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verbraucher nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update consumer error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Verbrauchers' });
  }
});

// DELETE /api/consumers/:id - Verbraucher löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'DELETE FROM power_consumers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verbraucher nicht gefunden' });
    }

    res.json({ message: 'Verbraucher gelöscht' });
  } catch (error) {
    console.error('Delete consumer error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Verbrauchers' });
  }
});

// PATCH /api/consumers/:id/toggle - Verbraucher aktivieren/deaktivieren
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE power_consumers 
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verbraucher nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Toggle consumer error:', error);
    res.status(500).json({ error: 'Fehler beim Umschalten des Verbrauchers' });
  }
});

export default router;
