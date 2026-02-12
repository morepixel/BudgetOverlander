// DaysLeft Backend API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Routes
import authRouter from './routes/auth.js';
import vehiclesRouter from './routes/vehicles.js';
import resourcesRouter from './routes/resources.js';
import consumersRouter from './routes/consumers.js';
import customResourcesRouter from './routes/custom-resources.js';
import premiumRouter from './routes/premium.js';

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
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
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
  console.log(`\n🚀 DaysLeft Backend läuft auf Port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health\n`);
});
