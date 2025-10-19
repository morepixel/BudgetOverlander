// Vehicles Routes - Fahrzeug-Profile
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/vehicles - Alle Fahrzeuge des Users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE user_id = $1', [req.user.userId]);
    res.json({ vehicles: result.rows });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Fahrzeuge' });
  }
});

// POST /api/vehicles - Neues Fahrzeug anlegen
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      width,
      height,
      weight,
      fourWheelDrive,
      groundClearance,
      tireType,
      fuelConsumptionOnroad,
      fuelConsumptionOffroad,
      isDefault
    } = req.body;

    if (!name || !width || !height || !weight) {
      return res.status(400).json({ error: 'Name, Breite, Höhe und Gewicht sind erforderlich' });
    }

    // Wenn isDefault=true, setze alle anderen auf false
    if (isDefault) {
      await pool.query('UPDATE vehicles SET is_default = false WHERE user_id = $1', [req.user.userId]);
    }

    const result = await pool.query(
      `INSERT INTO vehicles (
        user_id, name, width, height, weight, four_wheel_drive, 
        ground_clearance, tire_type, fuel_consumption_onroad, 
        fuel_consumption_offroad, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        req.user.userId,
        name,
        parseFloat(width),
        parseFloat(height),
        parseFloat(weight),
        fourWheelDrive || false,
        groundClearance ? parseFloat(groundClearance) : 0.2,
        tireType || 'AT',
        fuelConsumptionOnroad ? parseFloat(fuelConsumptionOnroad) : 12,
        fuelConsumptionOffroad ? parseFloat(fuelConsumptionOffroad) : 18,
        isDefault || false
      ]
    );

    res.status(201).json({
      message: 'Fahrzeug angelegt',
      vehicleId: result.rows[0].id
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen des Fahrzeugs' });
  }
});

// PUT /api/vehicles/:id/default - Fahrzeug als Standard setzen
router.put('/:id/default', authenticateToken, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    // Alle auf false setzen
    await pool.query('UPDATE vehicles SET is_default = false WHERE user_id = $1', [req.user.userId]);

    // Ausgewähltes auf true setzen
    await pool.query('UPDATE vehicles SET is_default = true WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);

    res.json({ message: 'Standard-Fahrzeug gesetzt' });
  } catch (error) {
    console.error('Set default vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Setzen des Standard-Fahrzeugs' });
  }
});

// DELETE /api/vehicles/:id - Fahrzeug löschen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }

    res.json({ message: 'Fahrzeug gelöscht' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// GET /api/vehicles/default - Standard-Fahrzeug oder Default
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE user_id = $1', [req.user.userId]);
    const vehicles = result.rows;

    // Suche Standard-Fahrzeug
    let defaultVehicle = vehicles.find(v => v.is_default);

    // Falls keins vorhanden, nutze erstes oder Default-FUSO
    if (!defaultVehicle) {
      if (vehicles.length > 0) {
        defaultVehicle = vehicles[0];
      } else {
        // Default FUSO-Profil
        defaultVehicle = {
          id: null,
          name: 'FUSO Canter (Default)',
          width: 2.3,
          height: 3.5,
          weight: 7.5,
          four_wheel_drive: true,
          ground_clearance: 0.25,
          tire_type: 'AT',
          fuel_consumption_onroad: 12,
          fuel_consumption_offroad: 18,
          is_default: true
        };
      }
    }

    res.json({ vehicle: defaultVehicle });
  } catch (error) {
    console.error('Get default vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

export default router;
