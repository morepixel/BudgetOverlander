import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Auto-Migration für custom_resources Tabelle
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_resources (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(10) DEFAULT '📦',
        unit VARCHAR(20) DEFAULT 'Stück',
        capacity DECIMAL(10,2) NOT NULL,
        consumption_per_day DECIMAL(6,2),
        current_level DECIMAL(10,2),
        current_percentage DECIMAL(5,2),
        is_inverted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ custom_resources table ready');
  } catch (err) {
    console.log('custom_resources migration:', err.message);
  }
})();

// GET alle Custom Resources für ein Fahrzeug
router.get('/:vehicleId', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const result = await pool.query(
      'SELECT * FROM custom_resources WHERE vehicle_id = $1 AND user_id = $2 ORDER BY name',
      [vehicleId, req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get custom resources error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Custom Resources' });
  }
});

// POST neue Custom Resource erstellen
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, name, icon, unit, capacity, consumptionPerDay, isInverted } = req.body;
    
    const result = await pool.query(`
      INSERT INTO custom_resources (vehicle_id, user_id, name, icon, unit, capacity, consumption_per_day, current_level, current_percentage, is_inverted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      vehicleId,
      req.user.userId,
      name,
      icon || '📦',
      unit || 'Stück',
      capacity,
      consumptionPerDay || null,
      isInverted ? 0 : capacity, // Bei inverted starten wir bei 0 (leer), sonst bei voll
      isInverted ? 0 : 100,
      isInverted || false
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create custom resource error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Custom Resource' });
  }
});

// PUT Custom Resource aktualisieren
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, unit, capacity, consumptionPerDay, currentLevel, isInverted } = req.body;
    
    // Berechne Prozent
    let percentage = 0;
    if (capacity && currentLevel !== undefined) {
      percentage = (currentLevel / capacity) * 100;
    }
    
    const result = await pool.query(`
      UPDATE custom_resources 
      SET name = COALESCE($1, name),
          icon = COALESCE($2, icon),
          unit = COALESCE($3, unit),
          capacity = COALESCE($4, capacity),
          consumption_per_day = $5,
          current_level = COALESCE($6, current_level),
          current_percentage = $7,
          is_inverted = COALESCE($8, is_inverted),
          updated_at = NOW()
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `, [name, icon, unit, capacity, consumptionPerDay, currentLevel, percentage, isInverted, id, req.user.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom Resource nicht gefunden' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update custom resource error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Custom Resource' });
  }
});

// PUT Level aktualisieren (für Slider)
router.put('/:id/level', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { level } = req.body;
    
    // Hole aktuelle Resource für Kapazität
    const current = await pool.query('SELECT * FROM custom_resources WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Custom Resource nicht gefunden' });
    }
    
    const resource = current.rows[0];
    const percentage = (level / resource.capacity) * 100;
    
    const result = await pool.query(`
      UPDATE custom_resources 
      SET current_level = $1, current_percentage = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [level, percentage, id, req.user.userId]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update custom resource level error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Levels' });
  }
});

// DELETE Custom Resource löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM custom_resources WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom Resource nicht gefunden' });
    }
    
    res.json({ message: 'Custom Resource gelöscht' });
  } catch (error) {
    console.error('Delete custom resource error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Custom Resource' });
  }
});

export default router;
