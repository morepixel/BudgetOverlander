// Resources Routes - Ressourcen-Tracking für DaysLeft
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Auto-Migration für Toiletten-Spalten in current_levels
(async () => {
  try {
    await pool.query(`
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS ttt_solid_level DECIMAL(10,2);
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS ttt_solid_percentage DECIMAL(5,2);
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS ttt_liquid_level DECIMAL(10,2);
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS ttt_liquid_percentage DECIMAL(5,2);
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS clesana_bags_remaining INTEGER;
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS chemical_level DECIMAL(10,2);
      ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS chemical_percentage DECIMAL(5,2);
    `);
    console.log('✅ toilet level columns ready');
  } catch (err) {
    console.error('toilet columns migration:', err.message);
  }
})();

// Alle verfügbaren Ressourcen-Typen
const RESOURCE_TYPES = {
  water: { 
    icon: '💧', 
    name: 'Wasser', 
    unit: 'L', 
    capacityField: 'fresh_water_capacity',
    consumptionField: 'water_consumption_per_day',
    levelField: 'water_level',
    percentageField: 'water_percentage',
    remainingField: 'water_days_remaining',
    remainingType: 'days',
    inverted: false
  },
  power: { 
    icon: '🔋', 
    name: 'Batterie', 
    unit: 'Ah', 
    capacityField: 'battery_capacity',
    consumptionField: 'power_consumption_per_day',
    levelField: 'power_level',
    percentageField: 'power_percentage',
    remainingField: 'power_days_remaining',
    remainingType: 'days',
    inverted: false
  },
  fuel: { 
    icon: '⛽', 
    name: 'Treibstoff', 
    unit: 'L', 
    capacityField: 'fuel_tank_capacity',
    consumptionField: 'fuel_consumption',
    levelField: 'fuel_level',
    percentageField: 'fuel_percentage',
    remainingField: 'fuel_km_remaining',
    remainingType: 'km',
    inverted: false
  },
  gas: { 
    icon: '🔥', 
    name: 'Gas', 
    unit: 'kg', 
    capacityField: 'gas_capacity',
    consumptionField: 'gas_consumption_per_day',
    levelField: 'gas_level',
    percentageField: 'gas_percentage',
    remainingField: 'gas_days_remaining',
    remainingType: 'days',
    inverted: false
  },
  greywater: { 
    icon: '🚿', 
    name: 'Abwasser', 
    unit: 'L', 
    capacityField: 'grey_water_capacity',
    consumptionField: 'water_consumption_per_day',
    levelField: 'greywater_level',
    percentageField: 'greywater_percentage',
    remainingField: 'greywater_days_remaining',
    remainingType: 'days',
    inverted: true  // Je voller desto schlechter
  },
  toilet: { 
    icon: '🚽', 
    name: 'Toilette', 
    unit: 'Nutzungen', 
    capacityField: 'toilet_capacity',
    consumptionField: 'toilet_consumption_per_day',
    levelField: 'toilet_level',
    percentageField: 'toilet_percentage',
    remainingField: 'toilet_uses_remaining',
    remainingType: 'uses',
    inverted: true  // Je voller desto schlechter (außer Clesana)
  },
  food: { 
    icon: '🍽️', 
    name: 'Essen', 
    unit: 'Tage', 
    capacityField: 'food_capacity',
    consumptionField: 'food_consumption_per_day',
    levelField: 'food_level',
    percentageField: 'food_percentage',
    remainingField: 'food_days_remaining',
    remainingType: 'days',
    inverted: false
  },
  drinks: { 
    icon: '🥤', 
    name: 'Getränke', 
    unit: 'L', 
    capacityField: 'drinks_capacity',
    consumptionField: 'drinks_consumption_per_day',
    levelField: 'drinks_level',
    percentageField: 'drinks_percentage',
    remainingField: 'drinks_days_remaining',
    remainingType: 'days',
    inverted: false
  },
  beer: { 
    icon: '🍺', 
    name: 'Bier', 
    unit: 'Flaschen', 
    capacityField: 'beer_capacity',
    consumptionField: 'beer_consumption_per_day',
    levelField: 'beer_level',
    percentageField: 'beer_percentage',
    remainingField: 'beer_days_remaining',
    remainingType: 'days',
    inverted: false
  }
};

// GET /api/resources/types - Alle verfügbaren Ressourcen-Typen
router.get('/types', (req, res) => {
  res.json({ types: RESOURCE_TYPES });
});

// GET /api/resources/current - Aktuelle Füllstände
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId;
    
    // Hole Standard-Fahrzeug wenn keine ID
    let vehicle;
    if (vehicleId) {
      const vResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
      vehicle = vResult.rows[0];
    } else {
      const vResult = await pool.query('SELECT * FROM vehicles WHERE user_id = $1 AND is_default = true', [req.user.userId]);
      vehicle = vResult.rows[0];
      if (!vehicle) {
        const vResult2 = await pool.query('SELECT * FROM vehicles WHERE user_id = $1 LIMIT 1', [req.user.userId]);
        vehicle = vResult2.rows[0];
      }
    }

    if (!vehicle) {
      return res.json({ 
        levels: null, 
        vehicle: null,
        message: 'Kein Fahrzeug gefunden. Bitte zuerst ein Fahrzeug anlegen.' 
      });
    }

    // Hole aktuelle Levels
    const levelsResult = await pool.query('SELECT * FROM current_levels WHERE vehicle_id = $1', [vehicle.id]);
    let levels = levelsResult.rows[0];

    // Falls keine Levels existieren, erstelle Default
    if (!levels) {
      const insertResult = await pool.query(
        `INSERT INTO current_levels (vehicle_id, user_id, 
          water_level, water_percentage, water_days_remaining,
          power_level, power_percentage, power_days_remaining,
          fuel_level, fuel_percentage, fuel_km_remaining,
          gas_level, gas_percentage, gas_days_remaining
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          vehicle.id, req.user.userId,
          vehicle.fresh_water_capacity || 0, 100, null,
          vehicle.battery_capacity || 0, 100, null,
          vehicle.fuel_tank_capacity || 0, 100, null,
          vehicle.gas_capacity || 0, 100, null
        ]
      );
      levels = insertResult.rows[0];
    }

    // Fix: Wenn Level 0 aber Percentage > 0, berechne Level aus Percentage und Kapazität
    // Hinweis: parseFloat nötig, da PostgreSQL DECIMAL als String zurückgibt
    if (parseFloat(levels.water_level) == 0 && parseFloat(levels.water_percentage) > 0 && vehicle.fresh_water_capacity) {
      levels.water_level = Math.round(vehicle.fresh_water_capacity * parseFloat(levels.water_percentage) / 100);
    }
    if (parseFloat(levels.power_level) == 0 && parseFloat(levels.power_percentage) > 0 && vehicle.battery_capacity) {
      levels.power_level = Math.round(vehicle.battery_capacity * parseFloat(levels.power_percentage) / 100);
    }
    if (parseFloat(levels.fuel_level) == 0 && parseFloat(levels.fuel_percentage) > 0 && vehicle.fuel_tank_capacity) {
      levels.fuel_level = Math.round(vehicle.fuel_tank_capacity * parseFloat(levels.fuel_percentage) / 100);
    }
    if (parseFloat(levels.gas_level) == 0 && parseFloat(levels.gas_percentage) > 0 && vehicle.gas_capacity) {
      levels.gas_level = Math.round(vehicle.gas_capacity * parseFloat(levels.gas_percentage) / 100);
    }

    // Berechne Tage/km verbleibend
    const calculated = calculateRemaining(vehicle, levels);
    
    // Strom: Berechne mit aktiven Verbrauchern und Solar
    if (levels.power_level != null) {
      const consumersResult = await pool.query(
        'SELECT COALESCE(SUM(consumption_ah), 0) as total FROM power_consumers WHERE vehicle_id = $1 AND is_active = true',
        [vehicle.id]
      );
      const totalConsumption = parseFloat(consumersResult.rows[0]?.total) || 0;
      const solarWp = parseFloat(vehicle.solar_power) || 0;
      const estimatedSolarAh = solarWp > 0 ? (solarWp * 4 * 0.7 * 0.15) / 12 : 0;
      const netConsumption = totalConsumption - estimatedSolarAh;
      
      if (netConsumption > 0) {
        calculated.power_days_remaining = Math.round(parseFloat(levels.power_level) / netConsumption * 10) / 10;
      } else {
        calculated.power_days_remaining = 999; // Solar deckt Verbrauch
      }
    }

    res.json({ 
      levels: { ...levels, ...calculated },
      vehicle 
    });
  } catch (error) {
    console.error('Get current levels error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Füllstände' });
  }
});

// POST /api/resources/log - Ressourcen-Eintrag hinzufügen (generisch für alle Typen)
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, resourceType, action, amount, notes, lat, lon } = req.body;

    if (!vehicleId || !resourceType || !action) {
      return res.status(400).json({ error: 'vehicleId, resourceType und action sind erforderlich' });
    }

    const typeConfig = RESOURCE_TYPES[resourceType];
    if (!typeConfig) {
      return res.status(400).json({ error: 'Ungültiger resourceType' });
    }

    // Hole Fahrzeug
    const vResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
    const vehicle = vResult.rows[0];
    if (!vehicle) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }

    // Hole aktuelle Levels
    const levelsResult = await pool.query('SELECT * FROM current_levels WHERE vehicle_id = $1', [vehicleId]);
    let levels = levelsResult.rows[0];

    // Capacity ermitteln (Sonderfall fuel mit auxiliary tank)
    let capacity = vehicle[typeConfig.capacityField] || 100;
    if (resourceType === 'fuel' && vehicle.auxiliary_tank_capacity) {
      capacity += vehicle.auxiliary_tank_capacity;
    }

    // Berechne neuen Füllstand
    let newLevel;
    const currentLevel = levels?.[typeConfig.levelField] || 0;

    if (action === 'fill') {
      newLevel = Math.min(currentLevel + amount, capacity);
    } else if (action === 'use') {
      newLevel = Math.max(currentLevel - amount, 0);
    } else if (action === 'set_level') {
      newLevel = Math.min(Math.max(amount, 0), capacity);
    } else if (action === 'empty') {
      newLevel = 0;
    } else if (action === 'full') {
      newLevel = capacity;
    }

    const newPercentage = capacity > 0 ? (newLevel / capacity) * 100 : 0;

    // Update in DB
    const updateQuery = `UPDATE current_levels SET ${typeConfig.levelField} = $1, ${typeConfig.percentageField} = $2 WHERE vehicle_id = $3`;
    await pool.query(updateQuery, [newLevel, newPercentage, vehicleId]);

    // Log-Eintrag erstellen
    await pool.query(
      `INSERT INTO resource_logs (vehicle_id, user_id, resource_type, action, amount, unit, current_level, current_percentage, location_lat, location_lon, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [vehicleId, req.user.userId, resourceType, action, amount, typeConfig.unit, newLevel, newPercentage, lat || null, lon || null, notes || null]
    );

    // Hole aktualisierte Levels
    const updatedLevelsResult = await pool.query('SELECT * FROM current_levels WHERE vehicle_id = $1', [vehicleId]);
    const updatedLevels = updatedLevelsResult.rows[0];
    const calculated = calculateRemaining(vehicle, updatedLevels);
    
    // Strom: Berechne mit aktiven Verbrauchern und Solar
    if (updatedLevels.power_level != null) {
      const consumersResult = await pool.query(
        'SELECT COALESCE(SUM(consumption_ah), 0) as total FROM power_consumers WHERE vehicle_id = $1 AND is_active = true',
        [vehicle.id]
      );
      const totalConsumption = parseFloat(consumersResult.rows[0]?.total) || 0;
      const solarWp = parseFloat(vehicle.solar_power) || 0;
      const estimatedSolarAh = solarWp > 0 ? (solarWp * 4 * 0.7 * 0.15) / 12 : 0;
      const netConsumption = totalConsumption - estimatedSolarAh;
      
      if (netConsumption > 0) {
        calculated.power_days_remaining = Math.round(parseFloat(updatedLevels.power_level) / netConsumption * 10) / 10;
      } else {
        calculated.power_days_remaining = 999;
      }
    }

    res.json({ 
      message: 'Ressource aktualisiert',
      levels: { ...updatedLevels, ...calculated }
    });
  } catch (error) {
    console.error('Log resource error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// POST /api/resources/toilet-use - Toiletten-Nutzung tracken
router.post('/toilet-use', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, useType } = req.body;
    
    const vResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
    const vehicle = vResult.rows[0];
    if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

    // Hole oder erstelle current_levels
    let levelsResult = await pool.query('SELECT * FROM current_levels WHERE vehicle_id = $1', [vehicleId]);
    if (levelsResult.rows.length === 0) {
      await pool.query('INSERT INTO current_levels (vehicle_id, user_id) VALUES ($1, $2)', [vehicleId, req.user.userId]);
      levelsResult = await pool.query('SELECT * FROM current_levels WHERE vehicle_id = $1', [vehicleId]);
    }
    let levels = levelsResult.rows[0];

    const toiletType = vehicle.toilet_type || 'ttt';
    
    if (toiletType === 'ttt') {
      // Durchschnittswerte: Feststoff ~0.15L, Urin ~0.3L pro Nutzung
      if (useType === 'solid') {
        const solidCap = vehicle.ttt_solid_capacity || 10;
        const currentLevel = parseFloat(levels.ttt_solid_level) || 0;
        const newLevel = Math.min(currentLevel + 0.15, solidCap);
        const newPct = solidCap > 0 ? (newLevel / solidCap) * 100 : 0;
        await pool.query('UPDATE current_levels SET ttt_solid_level = $1, ttt_solid_percentage = $2 WHERE vehicle_id = $3', [newLevel, newPct, vehicleId]);
      } else if (useType === 'liquid') {
        const liquidCap = vehicle.ttt_liquid_capacity || 10;
        const currentLevel = parseFloat(levels.ttt_liquid_level) || 0;
        const newLevel = Math.min(currentLevel + 0.3, liquidCap);
        const newPct = liquidCap > 0 ? (newLevel / liquidCap) * 100 : 0;
        await pool.query('UPDATE current_levels SET ttt_liquid_level = $1, ttt_liquid_percentage = $2 WHERE vehicle_id = $3', [newLevel, newPct, vehicleId]);
      }
    } else if (toiletType === 'clesana') {
      const bagsCap = vehicle.clesana_bags_capacity || 50;
      const remaining = Math.max((levels.clesana_bags_remaining ?? bagsCap) - 1, 0);
      await pool.query('UPDATE current_levels SET clesana_bags_remaining = $1 WHERE vehicle_id = $2', [remaining, vehicleId]);
    } else if (toiletType === 'chemical') {
      // Durchschnitt ~0.5L pro Nutzung
      const tankCap = vehicle.chemical_tank_capacity || 20;
      const currentLevel = parseFloat(levels.chemical_level) || 0;
      const newLevel = Math.min(currentLevel + 0.5, tankCap);
      const newPct = tankCap > 0 ? (newLevel / tankCap) * 100 : 0;
      await pool.query('UPDATE current_levels SET chemical_level = $1, chemical_percentage = $2 WHERE vehicle_id = $3', [newLevel, newPct, vehicleId]);
    }

    res.json({ message: 'Toiletten-Nutzung erfasst' });
  } catch (error) {
    console.error('Toilet use error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// POST /api/resources/toilet-empty - Toiletten-Tank leeren
router.post('/toilet-empty', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, tankType } = req.body;
    
    const vResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
    const vehicle = vResult.rows[0];
    if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

    const toiletType = vehicle.toilet_type || 'ttt';
    
    if (toiletType === 'ttt') {
      if (tankType === 'solid') {
        await pool.query('UPDATE current_levels SET ttt_solid_level = 0, ttt_solid_percentage = 0 WHERE vehicle_id = $1', [vehicleId]);
      } else if (tankType === 'liquid') {
        await pool.query('UPDATE current_levels SET ttt_liquid_level = 0, ttt_liquid_percentage = 0 WHERE vehicle_id = $1', [vehicleId]);
      }
    } else if (toiletType === 'clesana') {
      // Clesana: Tüten auffüllen
      const bagsCap = vehicle.clesana_bags_capacity || 50;
      await pool.query('UPDATE current_levels SET clesana_bags_remaining = $1 WHERE vehicle_id = $2', [bagsCap, vehicleId]);
    } else if (toiletType === 'chemical') {
      // Chemical: Tank leeren
      await pool.query('UPDATE current_levels SET chemical_level = 0, chemical_percentage = 0 WHERE vehicle_id = $1', [vehicleId]);
    }

    res.json({ message: 'Toilette geleert' });
  } catch (error) {
    console.error('Toilet empty error:', error);
    res.status(500).json({ error: 'Fehler beim Leeren' });
  }
});

// GET /api/resources/history - Verlauf
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, resourceType, limit = 50 } = req.query;

    let query = 'SELECT * FROM resource_logs WHERE user_id = $1';
    const params = [req.user.userId];
    let paramCount = 2;

    if (vehicleId) {
      query += ` AND vehicle_id = $${paramCount}`;
      params.push(vehicleId);
      paramCount++;
    }

    if (resourceType) {
      query += ` AND resource_type = $${paramCount}`;
      params.push(resourceType);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Verlaufs' });
  }
});

// Hilfsfunktion: Berechne verbleibende Tage/km/Nutzungen für alle Ressourcen
function calculateRemaining(vehicle, levels) {
  const result = {};
  if (!levels) return result;
  
  const persons = vehicle.person_count || 2;

  // 1. Wasser - Verbrauch pro Person × Anzahl Personen
  if (levels.water_level != null || levels.water_percentage != null) {
    const consumptionPerPerson = parseFloat(vehicle.water_consumption_per_day) || 5; // Default: 5L pro Person/Tag
    const totalConsumption = consumptionPerPerson * persons;
    // Level aus Percentage berechnen falls nötig
    let waterLevel = parseFloat(levels.water_level) || 0;
    if (waterLevel === 0 && parseFloat(levels.water_percentage) > 0 && vehicle.fresh_water_capacity) {
      waterLevel = vehicle.fresh_water_capacity * parseFloat(levels.water_percentage) / 100;
    }
    if (totalConsumption > 0) {
      result.water_days_remaining = Math.round(waterLevel / totalConsumption * 10) / 10;
    }
  }

  // 2. Strom - wird separat mit Verbrauchern berechnet (siehe calculatePowerRemaining)
  // Fallback falls keine Verbraucher-Daten vorhanden
  if (levels.power_level != null && result.power_days_remaining === undefined) {
    const consumption = vehicle.power_consumption_per_day || 50;
    result.power_days_remaining = Math.round(levels.power_level / consumption * 10) / 10;
  }

  // 3. Kraftstoff (km statt Tage)
  if (levels.fuel_level != null) {
    const consumption = vehicle.fuel_consumption || vehicle.fuel_consumption_onroad || 12;
    result.fuel_km_remaining = Math.round(levels.fuel_level / consumption * 100);
  }

  // 4. Gas - Verbrauch pro Person × Anzahl Personen
  if (levels.gas_level != null) {
    const consumptionPerPerson = vehicle.gas_consumption_per_day || 0.25; // Default: 0.25kg pro Person/Tag
    const totalConsumption = consumptionPerPerson * persons;
    result.gas_days_remaining = Math.round(levels.gas_level / totalConsumption * 10) / 10;
  }

  // 5. Abwasser (invertiert: Tage bis voll) - Verbrauch pro Person × Anzahl Personen
  if (levels.greywater_level != null && vehicle.grey_water_capacity) {
    const consumptionPerPerson = vehicle.water_consumption_per_day || 5;
    const totalConsumption = consumptionPerPerson * persons;
    const remaining = vehicle.grey_water_capacity - levels.greywater_level;
    result.greywater_days_remaining = Math.round(remaining / totalConsumption * 10) / 10;
  }

  // 6. Toilette - je nach Typ (ca. 6 Gänge pro Person pro Tag)
  const toiletUsesPerDay = 6 * persons;
  if (vehicle.toilet_type === 'ttt') {
    // TTT: Feststoff ~0.15L/Gang, Urin ~0.3L/Gang
    if (vehicle.ttt_solid_capacity) {
      const solidRemaining = vehicle.ttt_solid_capacity - (levels.ttt_solid_level || 0);
      result.ttt_solid_days = Math.round(solidRemaining / (0.15 * toiletUsesPerDay) * 10) / 10;
    }
    if (vehicle.ttt_liquid_capacity) {
      const liquidRemaining = vehicle.ttt_liquid_capacity - (levels.ttt_liquid_level || 0);
      result.ttt_liquid_days = Math.round(liquidRemaining / (0.3 * toiletUsesPerDay) * 10) / 10;
    }
  } else if (vehicle.toilet_type === 'clesana') {
    // Clesana: ~1 Tüte pro 3 Gänge
    const bagsRemaining = levels.clesana_bags_remaining ?? vehicle.clesana_bags_capacity;
    result.clesana_days = Math.round(bagsRemaining / (toiletUsesPerDay / 3) * 10) / 10;
  } else if (vehicle.toilet_type === 'chemical') {
    // Chemie: ~0.5L pro Gang
    if (vehicle.chemical_tank_capacity) {
      const remaining = vehicle.chemical_tank_capacity - (levels.chemical_level || 0);
      result.chemical_days = Math.round(remaining / (0.5 * toiletUsesPerDay) * 10) / 10;
    }
  }

  // 7. Essen (automatisch: 1 Tagesration pro Person)
  if (levels.food_level != null) {
    const consumption = persons; // 1 pro Person pro Tag
    result.food_days_remaining = Math.round(levels.food_level / consumption * 10) / 10;
  }

  // 8. Getränke (automatisch: 1.5L pro Person pro Tag)
  if (levels.drinks_level != null) {
    const consumption = 1.5 * persons;
    result.drinks_days_remaining = Math.round(levels.drinks_level / consumption * 10) / 10;
  }

  // 9. Bier - Verbrauch pro Person × Anzahl Personen
  if (levels.beer_level != null) {
    const consumptionPerPerson = vehicle.beer_consumption_per_day || 1; // Default: 1 Flasche pro Person/Tag
    const totalConsumption = consumptionPerPerson * persons;
    result.beer_days_remaining = Math.round(levels.beer_level / totalConsumption * 10) / 10;
  }

  return result;
}

export default router;
