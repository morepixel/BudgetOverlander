// DaysLeft Backend API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import cron from 'node-cron';
import pool from './database/db-postgres.js';

// Routes
import authRouter from './routes/auth.js';
import vehiclesRouter from './routes/vehicles.js';
import resourcesRouter from './routes/resources.js';
import consumersRouter from './routes/consumers.js';
import customResourcesRouter from './routes/custom-resources.js';
import premiumRouter from './routes/premium.js';
import testersRouter from './routes/testers.js';

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
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

// Cron-Job: Stündlicher Verbrauch (jede Stunde, 1/24 des Tageswertes)
cron.schedule('0 * * * *', async () => {
  const hour = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  console.log(`⏰ Cron-Job: Stündlicher Verbrauch (${hour})...`);
  try {
    let updatedCustom = 0;
    let updatedBattery = 0;
    
    // 1. Custom Resources mit consumption_per_day > 0 (1/24 pro Stunde)
    const resources = await pool.query(`
      SELECT cr.*, v.person_count 
      FROM custom_resources cr 
      JOIN vehicles v ON cr.vehicle_id = v.id 
      WHERE cr.consumption_per_day > 0
    `);
    
    for (const r of resources.rows) {
      const personCount = r.person_count || 2;
      const hourlyConsumption = (r.consumption_per_day * personCount) / 24;
      
      let newLevel;
      if (r.is_inverted) {
        newLevel = Math.min(parseFloat(r.current_level) + hourlyConsumption, parseFloat(r.capacity));
      } else {
        newLevel = Math.max(parseFloat(r.current_level) - hourlyConsumption, 0);
      }
      
      const newPercentage = (newLevel / r.capacity) * 100;
      
      await pool.query(`
        UPDATE custom_resources 
        SET current_level = $1, current_percentage = $2, updated_at = NOW()
        WHERE id = $3
      `, [newLevel, newPercentage, r.id]);
      
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
        const currentLevel = parseFloat(v.power_level) || 0;
        const capacity = parseFloat(v.battery_capacity) || 100;
        
        // Neuer Level (begrenzt auf 0 bis Kapazität)
        let newLevel = currentLevel - netHourlyConsumption;
        newLevel = Math.max(0, Math.min(newLevel, capacity));
        
        const newPercentage = (newLevel / capacity) * 100;
        
        await pool.query(`
          UPDATE current_levels 
          SET power_level = $1, power_percentage = $2, updated_at = NOW()
          WHERE vehicle_id = $3
        `, [newLevel, newPercentage, v.id]);
        
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

app.listen(PORT, () => {
  console.log(`\n🚀 DaysLeft Backend läuft auf Port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log(`⏰ Cron: Stündlicher Verbrauch (1/24 des Tageswertes)\n`);
});
