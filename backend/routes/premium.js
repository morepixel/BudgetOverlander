// Premium Routes – Stripe Checkout + Webhook
import express from 'express';
import Stripe from 'stripe';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

const PRICES = {
  monthly:  { eur: 3.99, label: 'Monatlich',      interval: 'month' },
  yearly:   { eur: 24.99, label: 'Jährlich',       interval: 'year'  },
  lifetime: { eur: 59.99, label: 'Einmalig – Für immer', interval: null },
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
}

// ─── Premium-Status ───────────────────────────────────────────────────────────
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT is_premium, premium_since, premium_until, premium_type
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });

    const user = result.rows[0];
    let isPremiumActive = user.is_premium;

    if (user.premium_until && new Date(user.premium_until) < new Date()) {
      isPremiumActive = false;
      await pool.query('UPDATE users SET is_premium = false WHERE id = $1', [req.user.userId]);
    }

    res.json({
      isPremium: isPremiumActive,
      premiumSince: user.premium_since,
      premiumUntil: user.premium_until,
      premiumType: user.premium_type,
    });
  } catch (error) {
    console.error('Premium status error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Premium-Status' });
  }
});

// ─── Preise abrufen ───────────────────────────────────────────────────────────
router.get('/prices', (req, res) => {
  res.json({
    prices: [
      { type: 'lifetime', price: 59.99, currency: 'EUR', label: 'Einmalig', description: 'Premium für immer – kein Abo' },
      { type: 'yearly',   price: 24.99, currency: 'EUR', label: 'Jährlich', description: 'Spart 48% gegenüber monatlich' },
      { type: 'monthly',  price: 3.99,  currency: 'EUR', label: 'Monatlich', description: 'Flexibel kündbar' },
    ],
  });
});

// ─── Stripe Checkout Session erstellen ───────────────────────────────────────
router.post('/checkout', authenticateToken, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Zahlungsystem nicht konfiguriert. Bitte wende dich an den Support.' });
  }

  const { premiumType } = req.body;
  if (!PRICES[premiumType]) return res.status(400).json({ error: 'Ungültiger Plan' });

  try {
    const userResult = await pool.query(
      'SELECT email, stripe_customer_id FROM users WHERE id = $1',
      [req.user.userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' });

    // Stripe Customer anlegen oder vorhandenen nutzen
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(req.user.userId) },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.user.userId]);
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const priceData = PRICES[premiumType];

    const sessionParams = {
      customer: customerId,
      mode: premiumType === 'lifetime' ? 'payment' : 'subscription',
      success_url: `${appUrl}/offgrid.html?premium=success&type=${premiumType}`,
      cancel_url:  `${appUrl}/offgrid.html?premium=cancelled`,
      metadata: { userId: String(req.user.userId), premiumType },
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `DaysLeft Premium – ${priceData.label}`,
            description: 'Kein manuelles Tracking mehr. Sensoren verbinden, alles automatisch.',
          },
          ...(premiumType === 'lifetime'
            ? { unit_amount: Math.round(priceData.eur * 100) }
            : {
                unit_amount: Math.round(priceData.eur * 100),
                recurring: { interval: priceData.interval },
              }),
        },
        quantity: 1,
      }],
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Checkout-Session' });
  }
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
// Hinweis: Raw-Body wird in server.js vor JSON-Middleware bereitgestellt
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Stripe nicht konfiguriert');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, premiumType } = session.metadata || {};
      if (userId && premiumType) {
        await activatePremium(parseInt(userId), premiumType, session.id);
        console.log(`✅ Premium aktiviert: user=${userId}, type=${premiumType}`);
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const customerId = subscription.customer;
        const userResult = await pool.query('SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]);
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          const premiumUntil = new Date(subscription.current_period_end * 1000);
          await pool.query(
            `UPDATE users SET is_premium = true, premium_until = $1 WHERE id = $2`,
            [premiumUntil, userId]
          );
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      await pool.query(
        `UPDATE users SET is_premium = false, premium_until = NOW() WHERE stripe_customer_id = $1`,
        [customerId]
      );
      console.log(`❌ Premium gekündigt: customer=${customerId}`);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }

  res.json({ received: true });
});

async function activatePremium(userId, premiumType, paymentId) {
  let premiumUntil = null;
  if (premiumType === 'monthly') {
    premiumUntil = new Date();
    premiumUntil.setMonth(premiumUntil.getMonth() + 1);
  } else if (premiumType === 'yearly') {
    premiumUntil = new Date();
    premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
  }

  await pool.query(
    `UPDATE users SET is_premium = true, premium_since = NOW(), premium_until = $1, premium_type = $2 WHERE id = $3`,
    [premiumUntil, premiumType, userId]
  );
  await pool.query(
    `INSERT INTO premium_transactions (user_id, transaction_type, premium_type, status, payment_id, completed_at)
     VALUES ($1, 'purchase', $2, 'completed', $3, NOW())`,
    [userId, premiumType, paymentId]
  );
}

// ─── Debug: Premium manuell aktivieren (nur development) ─────────────────────
router.post('/activate', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Nur im Development-Modus verfügbar. Bitte Stripe Checkout nutzen.' });
  }

  const { premiumType, paymentId } = req.body;
  try {
    await activatePremium(req.user.userId, premiumType || 'lifetime', paymentId || 'dev-' + Date.now());
    res.json({ success: true, message: 'Premium aktiviert (Dev-Modus)', isPremium: true, premiumType });
  } catch (error) {
    console.error('Premium activate error:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren von Premium' });
  }
});

export default router;
