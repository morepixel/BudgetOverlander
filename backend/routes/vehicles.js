// Vehicles Routes - Fahrzeugverwaltung
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Auto-Migration für neue Spalten
(async () => {
  try {
    await pool.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_solid_capacity INTEGER;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_liquid_capacity INTEGER;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_solid_ignore_autarky BOOLEAN DEFAULT FALSE;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_liquid_ignore_autarky BOOLEAN DEFAULT FALSE;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS clesana_bags_capacity INTEGER;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chemical_tank_capacity INTEGER;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS person_count INTEGER DEFAULT 2;
    `);
    console.log('✅ vehicle columns ready');
  } catch (err) {
    console.error('vehicle columns migration:', err.message);
  }
})();

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
      length,
      weight,
      fourWheelDrive,
      groundClearance,
      tireType,
      fuelConsumptionOnroad,
      fuelConsumptionOffroad,
      isDefault,
      // DaysLeft Felder
      freshWaterCapacity,
      greyWaterCapacity,
      waterConsumptionPerDay,
      batteryCapacity,
      batteryType,
      solarPower,
      shorePowerCharger,
      powerConsumptionPerDay,
      fuelTankCapacity,
      fuelType,
      fuelConsumption,
      auxiliaryTankCapacity,
      gasCapacity,
      gasConsumptionPerDay,
      toiletType,
      toiletCapacity,
      toiletConsumptionPerDay,
      tttSolidCapacity,
      tttLiquidCapacity,
      clesanaBagsCapacity,
      chemicalTankCapacity,
      foodCapacity,
      foodConsumptionPerDay,
      drinksCapacity,
      drinksConsumptionPerDay,
      beerCapacity,
      beerConsumptionPerDay,
      enabledResources
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    // Wenn isDefault=true, setze alle anderen auf false
    if (isDefault) {
      await pool.query('UPDATE vehicles SET is_default = false WHERE user_id = $1', [req.user.userId]);
    }

    const result = await pool.query(
      `INSERT INTO vehicles (
        user_id, name, width, height, length, weight, four_wheel_drive, 
        ground_clearance, tire_type, fuel_consumption_onroad, 
        fuel_consumption_offroad, is_default,
        fresh_water_capacity, grey_water_capacity, water_consumption_per_day,
        battery_capacity, battery_type, solar_power, shore_power_charger, power_consumption_per_day,
        fuel_tank_capacity, fuel_type, fuel_consumption, auxiliary_tank_capacity,
        gas_capacity, gas_consumption_per_day,
        toilet_type, toilet_capacity, toilet_consumption_per_day,
        ttt_solid_capacity, ttt_liquid_capacity, clesana_bags_capacity, chemical_tank_capacity,
        food_capacity, food_consumption_per_day,
        drinks_capacity, drinks_consumption_per_day,
        beer_capacity, beer_consumption_per_day,
        enabled_resources
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40) RETURNING *`,
      [
        req.user.userId,
        name,
        width ? parseFloat(width) : null,
        height ? parseFloat(height) : null,
        length ? parseFloat(length) : null,
        weight ? parseFloat(weight) : null,
        fourWheelDrive || false,
        groundClearance ? parseFloat(groundClearance) : null,
        tireType || null,
        fuelConsumptionOnroad ? parseFloat(fuelConsumptionOnroad) : null,
        fuelConsumptionOffroad ? parseFloat(fuelConsumptionOffroad) : null,
        isDefault || false,
        freshWaterCapacity ? parseInt(freshWaterCapacity) : null,
        greyWaterCapacity ? parseInt(greyWaterCapacity) : null,
        waterConsumptionPerDay ? parseFloat(waterConsumptionPerDay) : null,
        batteryCapacity ? parseInt(batteryCapacity) : null,
        batteryType || null,
        solarPower ? parseInt(solarPower) : null,
        shorePowerCharger ? parseInt(shorePowerCharger) : null,
        powerConsumptionPerDay ? parseFloat(powerConsumptionPerDay) : null,
        fuelTankCapacity ? parseInt(fuelTankCapacity) : null,
        fuelType || 'diesel',
        fuelConsumption ? parseFloat(fuelConsumption) : null,
        auxiliaryTankCapacity ? parseInt(auxiliaryTankCapacity) : null,
        gasCapacity ? parseFloat(gasCapacity) : null,
        gasConsumptionPerDay ? parseFloat(gasConsumptionPerDay) : null,
        toiletType || null,
        toiletCapacity ? parseInt(toiletCapacity) : null,
        toiletConsumptionPerDay ? parseFloat(toiletConsumptionPerDay) : null,
        tttSolidCapacity ? parseInt(tttSolidCapacity) : null,
        tttLiquidCapacity ? parseInt(tttLiquidCapacity) : null,
        clesanaBagsCapacity ? parseInt(clesanaBagsCapacity) : null,
        chemicalTankCapacity ? parseInt(chemicalTankCapacity) : null,
        foodCapacity ? parseInt(foodCapacity) : null,
        foodConsumptionPerDay ? parseFloat(foodConsumptionPerDay) : null,
        drinksCapacity ? parseInt(drinksCapacity) : null,
        drinksConsumptionPerDay ? parseFloat(drinksConsumptionPerDay) : null,
        beerCapacity ? parseInt(beerCapacity) : null,
        beerConsumptionPerDay ? parseFloat(beerConsumptionPerDay) : null,
        enabledResources || ['water', 'power', 'fuel', 'gas']
      ]
    );

    res.status(201).json({
      message: 'Fahrzeug angelegt',
      vehicle: result.rows[0]
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen des Fahrzeugs' });
  }
});

// PUT /api/vehicles/:id - Fahrzeug aktualisieren
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const updates = req.body;

    // Prüfe ob Fahrzeug dem User gehört
    const check = await pool.query('SELECT id FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }

    // Dynamisches Update bauen
    console.log('TTT Debug - updates:', JSON.stringify({
      tttSolidIgnoreAutarky: updates.tttSolidIgnoreAutarky,
      tttLiquidIgnoreAutarky: updates.tttLiquidIgnoreAutarky,
      toiletType: updates.toiletType
    }));
    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMapping = {
      name: 'name',
      width: 'width',
      height: 'height',
      length: 'length',
      weight: 'weight',
      fourWheelDrive: 'four_wheel_drive',
      groundClearance: 'ground_clearance',
      tireType: 'tire_type',
      fuelConsumptionOnroad: 'fuel_consumption_onroad',
      fuelConsumptionOffroad: 'fuel_consumption_offroad',
      freshWaterCapacity: 'fresh_water_capacity',
      greyWaterCapacity: 'grey_water_capacity',
      greywaterLinkedToWater: 'greywater_linked_to_water',
      greywaterLinkFactor: 'greywater_link_factor',
      waterConsumptionPerDay: 'water_consumption_per_day',
      batteryCapacity: 'battery_capacity',
      batteryType: 'battery_type',
      solarPower: 'solar_power',
      shorePowerCharger: 'shore_power_charger',
      powerConsumptionPerDay: 'power_consumption_per_day',
      fuelTankCapacity: 'fuel_tank_capacity',
      fuelType: 'fuel_type',
      fuelConsumption: 'fuel_consumption',
      auxiliaryTankCapacity: 'auxiliary_tank_capacity',
      gasCapacity: 'gas_capacity',
      gasConsumptionPerDay: 'gas_consumption_per_day',
      toiletType: 'toilet_type',
      toiletCapacity: 'toilet_capacity',
      toiletConsumptionPerDay: 'toilet_consumption_per_day',
      tttSolidCapacity: 'ttt_solid_capacity',
      tttLiquidCapacity: 'ttt_liquid_capacity',
      tttSolidIgnoreAutarky: 'ttt_solid_ignore_autarky',
      tttLiquidIgnoreAutarky: 'ttt_liquid_ignore_autarky',
      clesanaBagsCapacity: 'clesana_bags_capacity',
      chemicalTankCapacity: 'chemical_tank_capacity',
      foodCapacity: 'food_capacity',
      foodConsumptionPerDay: 'food_consumption_per_day',
      drinksCapacity: 'drinks_capacity',
      drinksConsumptionPerDay: 'drinks_consumption_per_day',
      beerCapacity: 'beer_capacity',
      beerConsumptionPerDay: 'beer_consumption_per_day',
      personCount: 'person_count'
    };

    // enabledResources als Array behandeln
    if (updates.enabledResources && Array.isArray(updates.enabledResources)) {
      fields.push(`enabled_resources = $${paramCount}`);
      values.push(updates.enabledResources);
      paramCount++;
    }

    for (const [jsField, dbField] of Object.entries(fieldMapping)) {
      if (updates[jsField] !== undefined) {
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[jsField]);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    values.push(vehicleId);
    const query = `UPDATE vehicles SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ message: 'Fahrzeug aktualisiert', vehicle: result.rows[0] });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
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
