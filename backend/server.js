// Budget Overlander Backend API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Routes
import regionsRouter from './routes/regions.js';
import routesRouter from './routes/routes.js';
import authRouter from './routes/auth.js';
import vehiclesRouter from './routes/vehicles.js';
import poisRouter from './routes/pois.js';
import questsRouter from './routes/quests.js';
import badgesRouter from './routes/badges.js';
import profileRouter from './routes/profile.js';
import accommodationsRouter from './routes/accommodations.js';
import tripPlannerRouter from './routes/trip-planner.js';
import geocodingRouter from './routes/geocoding.js';
import aiRoutesRouter from './routes/ai-routes.js';
import park4nightRouter from './routes/park4night.js';
import photosRouter from './routes/photos.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/pois', poisRouter);
app.use('/api/quests', questsRouter);
app.use('/api/badges', badgesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/accommodations', accommodationsRouter);
app.use('/api/trip-planner', tripPlannerRouter);
app.use('/api/geocoding', geocodingRouter);
app.use('/api/ai', aiRoutesRouter);
app.use('/api/park4night', park4nightRouter);
app.use('/api/photos', photosRouter);

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

app.listen(PORT, () => {
  console.log(`\n🚀 Budget Overlander Backend läuft auf Port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health\n`);
});
