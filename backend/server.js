// DaysLeft Backend API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import cron from 'node-cron';
import pool from './database/db-postgres.js';

// Auto-Migration für sensor_connections Tabelle
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        sensor_type VARCHAR(50) NOT NULL,
        credentials JSONB NOT NULL DEFAULT '{}',
        last_sync_at TIMESTAMPTZ,
        last_sync_status VARCHAR(20) DEFAULT 'pending',
        last_sync_error TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(vehicle_id, sensor_type)
      );
      CREATE INDEX IF NOT EXISTS idx_sensor_connections_active ON sensor_connections(is_active, sensor_type);
    `);
    // stripe_customer_id auf users
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);
    `);
    console.log('✅ sensor_connections table ready');
  } catch (err) {
    console.error('sensor_connections migration:', err.message);
  }
})();

// Auto-Migration für activity_log Tabelle
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_icon VARCHAR(10),
        description TEXT NOT NULL,
        old_value DECIMAL(10,2),
        new_value DECIMAL(10,2),
        change_amount DECIMAL(10,2),
        unit VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_activity_log_vehicle ON activity_log(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at DESC);
    `);
    console.log('✅ activity_log table ready');
  } catch (err) {
    console.error('activity_log migration:', err.message);
  }
})();

// Routes
import authRouter from './routes/auth.js';
import vehiclesRouter from './routes/vehicles.js';
import resourcesRouter from './routes/resources.js';
import consumersRouter from './routes/consumers.js';
import customResourcesRouter from './routes/custom-resources.js';
import premiumRouter from './routes/premium.js';
import testersRouter from './routes/testers.js';
import sensorsRouter, { syncVictronVRM } from './routes/sensors.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS für Web und Native Apps (Capacitor)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:8080',
    'https://budget.wirkstoff.com',
    'https://budget-overlander.moremedia.de',
    'capacitor://localhost',  // iOS Capacitor
    'ionic://localhost',      // Ionic Alternative
    'http://localhost'        // Android Capacitor
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/consumers', consumersRouter);
app.use('/api/custom-resources', customResourcesRouter);
app.use('/api/premium', premiumRouter);
app.use('/api/testers', testersRouter);
app.use('/api/sensors', sensorsRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Debug: CRON manuell triggern
app.get('/api/debug/trigger-cron', async (req, res) => {
  console.log('🔧 Debug: CRON manuell getriggert...');
  try {
    let updatedCustom = 0;
    let updatedBattery = 0;
    
    // 1. Custom Resources
    const resources = await pool.query(`
      SELECT cr.*, v.person_count, v.user_id as vehicle_user_id
      FROM custom_resources cr 
      JOIN vehicles v ON cr.vehicle_id = v.id 
      WHERE cr.consumption_per_day > 0
    `);
    
    for (const r of resources.rows) {
      const personCount = r.person_count || 2;
      const hourlyConsumption = (r.consumption_per_day * personCount) / 24;
      const oldLevel = parseFloat(r.current_level) || 0;
      
      let newLevel;
      if (r.is_inverted) {
        newLevel = Math.min(oldLevel + hourlyConsumption, parseFloat(r.capacity));
      } else {
        newLevel = Math.max(oldLevel - hourlyConsumption, 0);
      }
      
      const newPercentage = (newLevel / r.capacity) * 100;
      const changeAmount = Math.abs(newLevel - oldLevel);
      
      await pool.query(`
        UPDATE custom_resources 
        SET current_level = $1, current_percentage = $2, updated_at = NOW()
        WHERE id = $3
      `, [newLevel, newPercentage, r.id]);
      
      const direction = r.is_inverted ? '+' : '-';
      await logActivity(
        r.vehicle_id, r.vehicle_user_id, 'cron_consumption', r.name, r.icon,
        `${r.name}: ${direction}${changeAmount.toFixed(2)} ${r.unit} (stündl. Verbrauch)`,
        oldLevel, newLevel, changeAmount, r.unit
      );
      
      updatedCustom++;
    }
    
    // 2. Batterie
    const vehicles = await pool.query(`
      SELECT v.*, cl.power_level, cl.power_percentage
      FROM vehicles v
      LEFT JOIN current_levels cl ON v.id = cl.vehicle_id
      WHERE v.battery_capacity > 0
    `);
    
    for (const v of vehicles.rows) {
      const consumersResult = await pool.query(`
        SELECT COALESCE(SUM(consumption_ah), 0) as total_consumption
        FROM power_consumers 
        WHERE vehicle_id = $1 AND is_active = true
      `, [v.id]);
      const dailyConsumption = parseFloat(consumersResult.rows[0]?.total_consumption) || 0;
      const hourlyConsumption = dailyConsumption / 24;
      
      const solarWp = parseFloat(v.solar_power) || 0;
      const dailySolarAh = solarWp > 0 ? (solarWp * 4 * 0.7 * 0.15) / 12 : 0;
      const hourlySolarAh = dailySolarAh / 24;
      
      const netHourlyConsumption = hourlyConsumption - hourlySolarAh;
      
      if (netHourlyConsumption !== 0) {
        const oldLevel = parseFloat(v.power_level) || 0;
        const capacity = parseFloat(v.battery_capacity) || 100;
        
        let newLevel = oldLevel - netHourlyConsumption;
        newLevel = Math.max(0, Math.min(newLevel, capacity));
        
        const newPercentage = (newLevel / capacity) * 100;
        const changeAmount = Math.abs(newLevel - oldLevel);
        
        await pool.query(`
          UPDATE current_levels 
          SET power_level = $1, power_percentage = $2, updated_at = NOW()
          WHERE vehicle_id = $3
        `, [newLevel, newPercentage, v.id]);
        
        const direction = netHourlyConsumption > 0 ? '-' : '+';
        await logActivity(
          v.id, v.user_id, 'cron_consumption', 'power', '🔋',
          `Batterie: ${direction}${changeAmount.toFixed(2)} Ah (stündl. Verbrauch)`,
          oldLevel, newLevel, changeAmount, 'Ah'
        );
        
        updatedBattery++;
      }
    }
    
    console.log(`✅ Debug-Cron: ${updatedCustom} Custom Resources, ${updatedBattery} Batterien aktualisiert`);
    res.json({ success: true, updatedCustom, updatedBattery });
  } catch (error) {
    console.error('❌ Debug-Cron Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Server-Fehler'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint nicht gefunden' });
});

// Hilfsfunktion: Aktivität loggen
async function logActivity(vehicleId, userId, activityType, resourceType, resourceIcon, description, oldValue, newValue, changeAmount, unit) {
  try {
    await pool.query(`
      INSERT INTO activity_log (vehicle_id, user_id, activity_type, resource_type, resource_icon, description, old_value, new_value, change_amount, unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [vehicleId, userId, activityType, resourceType, resourceIcon, description, oldValue, newValue, changeAmount, unit]);
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

// Cron-Job: Stündlicher Verbrauch (jede Stunde, 1/24 des Tageswertes)
cron.schedule('0 * * * *', async () => {
  const hour = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  console.log(`⏰ Cron-Job: Stündlicher Verbrauch (${hour})...`);
  try {
    let updatedCustom = 0;
    let updatedBattery = 0;
    
    // 1. Custom Resources mit consumption_per_day > 0 (1/24 pro Stunde)
    const resources = await pool.query(`
      SELECT cr.*, v.person_count, v.user_id as vehicle_user_id
      FROM custom_resources cr 
      JOIN vehicles v ON cr.vehicle_id = v.id 
      WHERE cr.consumption_per_day > 0
    `);
    
    for (const r of resources.rows) {
      const personCount = r.person_count || 2;
      const hourlyConsumption = (r.consumption_per_day * personCount) / 24;
      const oldLevel = parseFloat(r.current_level) || 0;
      
      let newLevel;
      if (r.is_inverted) {
        newLevel = Math.min(oldLevel + hourlyConsumption, parseFloat(r.capacity));
      } else {
        newLevel = Math.max(oldLevel - hourlyConsumption, 0);
      }
      
      const newPercentage = (newLevel / r.capacity) * 100;
      const changeAmount = Math.abs(newLevel - oldLevel);
      
      await pool.query(`
        UPDATE custom_resources 
        SET current_level = $1, current_percentage = $2, updated_at = NOW()
        WHERE id = $3
      `, [newLevel, newPercentage, r.id]);
      
      // Aktivität loggen
      const direction = r.is_inverted ? '+' : '-';
      await logActivity(
        r.vehicle_id, r.vehicle_user_id, 'cron_consumption', r.name, r.icon,
        `${r.name}: ${direction}${changeAmount.toFixed(2)} ${r.unit} (stündl. Verbrauch)`,
        oldLevel, newLevel, changeAmount, r.unit
      );
      
      updatedCustom++;
    }
    
    // 2. Batterie: Verbraucher - Solar = Netto-Verbrauch (1/24 pro Stunde)
    const vehicles = await pool.query(`
      SELECT v.*, cl.power_level, cl.power_percentage
      FROM vehicles v
      LEFT JOIN current_levels cl ON v.id = cl.vehicle_id
      WHERE v.battery_capacity > 0
    `);
    
    for (const v of vehicles.rows) {
      // Aktive Verbraucher summieren (Ah pro Tag)
      const consumersResult = await pool.query(`
        SELECT COALESCE(SUM(consumption_ah), 0) as total_consumption
        FROM power_consumers 
        WHERE vehicle_id = $1 AND is_active = true
      `, [v.id]);
      const dailyConsumption = parseFloat(consumersResult.rows[0]?.total_consumption) || 0;
      const hourlyConsumption = dailyConsumption / 24;
      
      // Solar-Ertrag schätzen (ca. 4h Sonne pro Tag, verteilt auf 24h)
      const solarWp = parseFloat(v.solar_power) || 0;
      const dailySolarAh = solarWp > 0 ? (solarWp * 4 * 0.7 * 0.15) / 12 : 0;
      const hourlySolarAh = dailySolarAh / 24;
      
      // Netto-Verbrauch pro Stunde
      const netHourlyConsumption = hourlyConsumption - hourlySolarAh;
      
      if (netHourlyConsumption !== 0) {
        const oldLevel = parseFloat(v.power_level) || 0;
        const capacity = parseFloat(v.battery_capacity) || 100;
        
        // Neuer Level (begrenzt auf 0 bis Kapazität)
        let newLevel = oldLevel - netHourlyConsumption;
        newLevel = Math.max(0, Math.min(newLevel, capacity));
        
        const newPercentage = (newLevel / capacity) * 100;
        const changeAmount = Math.abs(newLevel - oldLevel);
        
        await pool.query(`
          UPDATE current_levels 
          SET power_level = $1, power_percentage = $2, updated_at = NOW()
          WHERE vehicle_id = $3
        `, [newLevel, newPercentage, v.id]);
        
        // Aktivität loggen
        const direction = netHourlyConsumption > 0 ? '-' : '+';
        await logActivity(
          v.id, v.user_id, 'cron_consumption', 'power', '🔋',
          `Batterie: ${direction}${changeAmount.toFixed(2)} Ah (stündl. Verbrauch)`,
          oldLevel, newLevel, changeAmount, 'Ah'
        );
        
        updatedBattery++;
      }
    }
    
    if (updatedCustom > 0 || updatedBattery > 0) {
      console.log(`✅ Cron: ${updatedCustom} Custom Resources, ${updatedBattery} Batterien aktualisiert`);
    }
  } catch (error) {
    console.error('❌ Cron-Job Fehler:', error);
  }
}, {
  timezone: 'Europe/Berlin'
});

// Cron-Job: Victron VRM Sensor-Sync (alle 15 Minuten)
cron.schedule('*/15 * * * *', async () => {
  try {
    const connections = await pool.query(`
      SELECT sc.id, sc.vehicle_id, sc.credentials
      FROM sensor_connections sc
      JOIN users u ON sc.user_id = u.id
      WHERE sc.sensor_type = 'victron_vrm'
        AND sc.is_active = true
        AND u.is_premium = true
        AND (u.premium_until IS NULL OR u.premium_until > NOW())
    `);

    if (connections.rows.length === 0) return;

    let synced = 0;
    for (const conn of connections.rows) {
      const result = await syncVictronVRM(conn.credentials, conn.vehicle_id);
      const status = result.success ? 'ok' : 'error';
      await pool.query(
        `UPDATE sensor_connections SET last_sync_at = NOW(), last_sync_status = $1, last_sync_error = $2, updated_at = NOW() WHERE id = $3`,
        [status, result.error || null, conn.id]
      );
      if (result.success) synced++;
    }

    if (synced > 0) console.log(`⚡ Victron VRM Sync: ${synced}/${connections.rows.length} Installationen aktualisiert`);
  } catch (error) {
    console.error('❌ Victron Cron-Job Fehler:', error);
  }
}, { timezone: 'Europe/Berlin' });

app.listen(PORT, () => {
  console.log(`\n🚀 DaysLeft Backend läuft auf Port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log(`⏰ Cron: Stündlicher Verbrauch + Victron VRM Sync alle 15 min\n`);
});
