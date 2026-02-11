// Premium Routes - Werbefreiheit & Premium-Status
import express from 'express';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Premium-Status abrufen
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT is_premium, premium_since, premium_until, premium_type 
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    
    const user = result.rows[0];
    
    // Prüfen ob Premium noch gültig ist
    let isPremiumActive = user.is_premium;
    if (user.premium_until && new Date(user.premium_until) < new Date()) {
      isPremiumActive = false;
      // Premium abgelaufen - Status aktualisieren
      await pool.query(
        'UPDATE users SET is_premium = false WHERE id = $1',
        [req.user.userId]
      );
    }
    
    res.json({
      isPremium: isPremiumActive,
      premiumSince: user.premium_since,
      premiumUntil: user.premium_until,
      premiumType: user.premium_type
    });
  } catch (error) {
    console.error('Premium status error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Premium-Status' });
  }
});

// Premium aktivieren (für Demo/Testing - später durch Payment ersetzen)
router.post('/activate', authenticateToken, async (req, res) => {
  try {
    const { premiumType, paymentId } = req.body;
    
    // Berechne Premium-Ende basierend auf Typ
    let premiumUntil = null;
    if (premiumType === 'monthly') {
      premiumUntil = new Date();
      premiumUntil.setMonth(premiumUntil.getMonth() + 1);
    } else if (premiumType === 'yearly') {
      premiumUntil = new Date();
      premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
    }
    // 'lifetime' = null (kein Ablaufdatum)
    
    // Premium aktivieren
    await pool.query(
      `UPDATE users SET 
        is_premium = true, 
        premium_since = NOW(), 
        premium_until = $1,
        premium_type = $2
       WHERE id = $3`,
      [premiumUntil, premiumType || 'lifetime', req.user.userId]
    );
    
    // Transaktion loggen
    await pool.query(
      `INSERT INTO premium_transactions 
        (user_id, transaction_type, premium_type, status, payment_id, completed_at)
       VALUES ($1, 'purchase', $2, 'completed', $3, NOW())`,
      [req.user.userId, premiumType || 'lifetime', paymentId || 'demo']
    );
    
    res.json({
      success: true,
      message: 'Premium erfolgreich aktiviert',
      isPremium: true,
      premiumType: premiumType || 'lifetime',
      premiumUntil
    });
  } catch (error) {
    console.error('Premium activate error:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren von Premium' });
  }
});

// Premium-Preise abrufen
router.get('/prices', async (req, res) => {
  res.json({
    prices: [
      { type: 'lifetime', price: 9.99, currency: 'EUR', label: 'Einmalig', description: 'Keine Werbung - für immer' },
      { type: 'yearly', price: 4.99, currency: 'EUR', label: 'Jährlich', description: 'Spart 50% gegenüber monatlich' },
      { type: 'monthly', price: 0.99, currency: 'EUR', label: 'Monatlich', description: 'Flexibel kündbar' }
    ]
  });
});

export default router;
