// Auth Routes - User Registration & Login
import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../database/db-postgres.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email bereits registriert' });
    }

    // Hash password
    const password_hash = await bcryptjs.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      [email, password_hash, name || null]
    );

    const userId = result.rows[0].id;

    // Initialize user stats
    await pool.query('INSERT INTO user_stats (user_id) VALUES ($1)', [userId]);

    // Generate token
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registrierung erfolgreich',
      token,
      user: {
        id: userId,
        email,
        name: name || null
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcryptjs.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login erfolgreich',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Passwort vergessen - Reset-Token generieren
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email erforderlich' });
    }

    // User finden
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    // Immer Erfolg melden (Sicherheit: nicht verraten ob Email existiert)
    if (result.rows.length === 0) {
      return res.json({ message: 'Falls ein Account mit dieser Email existiert, wurde ein Reset-Code gesendet.' });
    }

    const user = result.rows[0];
    
    // 6-stelligen Code generieren
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 Minuten gültig

    // Code in DB speichern
    await pool.query(
      `UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE id = $3`,
      [resetCode, resetExpires, user.id]
    );

    // TODO: Email senden (für jetzt: Code in Response für Entwicklung)
    console.log(`🔐 Reset-Code für ${email}: ${resetCode}`);

    // In Produktion würde hier eine Email gesendet werden
    // Für Entwicklung geben wir den Code direkt zurück
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ 
        message: 'Reset-Code wurde generiert.',
        devCode: resetCode // NUR für Entwicklung!
      });
    }

    res.json({ message: 'Falls ein Account mit dieser Email existiert, wurde ein Reset-Code gesendet.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// Passwort zurücksetzen mit Code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, Code und neues Passwort erforderlich' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }

    // User mit gültigem Code finden
    const result = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND reset_code = $2 AND reset_code_expires > NOW()`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Code' });
    }

    const userId = result.rows[0].id;

    // Neues Passwort hashen
    const password_hash = await bcryptjs.hash(newPassword, 10);

    // Passwort aktualisieren und Code löschen
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2`,
      [password_hash, userId]
    );

    res.json({ message: 'Passwort erfolgreich geändert. Du kannst dich jetzt einloggen.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// Middleware: Verify JWT Token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiger Token' });
    }
    
    // Verify user still exists in database
    try {
      const result = await pool.query('SELECT id FROM users WHERE id = $1', [user.userId]);
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'User nicht gefunden' });
      }
    } catch (dbError) {
      console.error('Auth DB error:', dbError);
      return res.status(500).json({ error: 'Authentifizierungsfehler' });
    }
    
    req.user = user;
    next();
  });
}

export default router;
