// Tester Registration Routes
import express from 'express';
import pool from '../database/db-postgres.js';

const router = express.Router();

// Tester registrieren
router.post('/register', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'E-Mail ist erforderlich' });
    }
    
    // Prüfen ob E-Mail bereits existiert
    const existing = await pool.query(
      'SELECT id FROM beta_testers WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
    }
    
    // Prüfen wie viele Tester es schon gibt
    const countResult = await pool.query('SELECT COUNT(*) FROM beta_testers');
    const currentCount = parseInt(countResult.rows[0].count);
    
    if (currentCount >= 20) {
      return res.status(410).json({ 
        error: 'Alle 20 Tester-Plätze sind bereits vergeben',
        spots_taken: currentCount,
        max_spots: 20
      });
    }
    
    // Neuen Tester einfügen
    const result = await pool.query(
      `INSERT INTO beta_testers (email, name, registered_at) 
       VALUES ($1, $2, NOW()) 
       RETURNING id, email, name, registered_at`,
      [email.toLowerCase(), name || null]
    );
    
    const tester = result.rows[0];
    const spotsRemaining = 20 - (currentCount + 1);
    
    console.log(`🎉 Neuer Beta-Tester registriert: ${email} (${currentCount + 1}/20)`);
    
    res.status(201).json({
      success: true,
      message: 'Erfolgreich als Tester registriert!',
      tester: {
        id: tester.id,
        email: tester.email,
        name: tester.name,
        registered_at: tester.registered_at
      },
      spots_remaining: spotsRemaining,
      position: currentCount + 1
    });
    
  } catch (error) {
    console.error('Tester registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Anzahl verfügbarer Plätze abfragen
router.get('/spots', async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM beta_testers');
    const currentCount = parseInt(countResult.rows[0].count);
    
    res.json({
      total_spots: 20,
      spots_taken: currentCount,
      spots_remaining: Math.max(0, 20 - currentCount)
    });
  } catch (error) {
    console.error('Spots query error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Plätze' });
  }
});

export default router;
