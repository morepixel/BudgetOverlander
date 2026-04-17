// Sensor Routes – Victron VRM Cloud API
import express from 'express';
import fetch from 'node-fetch';
import pool from '../database/db-postgres.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

const VRM_BASE = 'https://vrmapi.victronenergy.com/v2';

// ─── Victron VRM: Token verbinden + Installationen auflisten ─────────────────
router.post('/victron/connect', authenticateToken, async (req, res) => {
  const user = req.user;

  const premiumCheck = await pool.query('SELECT is_premium, premium_until FROM users WHERE id = $1', [user.userId]);
  const u = premiumCheck.rows[0];
  const isPremium = u?.is_premium && (!u.premium_until || new Date(u.premium_until) > new Date());
  if (!isPremium) {
    return res.status(403).json({
      error: 'premium_required',
      message: 'Sensor-Integration ist ein Premium-Feature. Bitte upgraden.',
    });
  }

  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken fehlt' });

  try {
    // VRM API testen: User-Installationen abrufen
    const vrmRes = await fetch(`${VRM_BASE}/users/me/installations`, {
      headers: { 'x-authorization': `Token ${accessToken}` },
    });

    if (!vrmRes.ok) {
      return res.status(400).json({ error: 'Ungültiger VRM Access Token. Bitte prüfe deinen Token im VRM Portal.' });
    }

    const vrmData = await vrmRes.json();
    const installations = (vrmData.records || []).map(i => ({
      id: i.idSite,
      name: i.name,
      lastSeen: i.lastTimestamp,
    }));

    res.json({ installations });
  } catch (err) {
    console.error('VRM connect error:', err);
    res.status(500).json({ error: 'Fehler beim Verbinden mit Victron VRM' });
  }
});

// ─── Victron VRM: Installation mit Fahrzeug verknüpfen ───────────────────────
router.post('/victron/link', authenticateToken, async (req, res) => {
  const { vehicleId, accessToken, installationId, installationName } = req.body;
  if (!vehicleId || !accessToken || !installationId) {
    return res.status(400).json({ error: 'vehicleId, accessToken und installationId sind erforderlich' });
  }

  // Fahrzeug-Ownership prüfen
  const vehicleCheck = await pool.query('SELECT id FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, req.user.userId]);
  if (vehicleCheck.rows.length === 0) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

  try {
    // Direkt einen Sync durchführen, um zu prüfen ob es funktioniert
    const syncResult = await syncVictronVRM({ accessToken, installationId }, vehicleId);

    await pool.query(
      `INSERT INTO sensor_connections (user_id, vehicle_id, sensor_type, credentials, last_sync_at, last_sync_status, is_active)
       VALUES ($1, $2, 'victron_vrm', $3, NOW(), $4, true)
       ON CONFLICT (vehicle_id, sensor_type) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         last_sync_at = NOW(),
         last_sync_status = $4,
         is_active = true,
         updated_at = NOW()`,
      [
        req.user.userId, vehicleId,
        JSON.stringify({ accessToken, installationId, installationName }),
        syncResult.success ? 'ok' : 'error',
      ]
    );

    res.json({
      success: true,
      message: syncResult.success
        ? `Victron verbunden! Batterie-Stand: ${syncResult.soc?.toFixed(0)}%`
        : 'Verbunden, aber erster Sync fehlgeschlagen. Wird beim nächsten Cron-Lauf erneut versucht.',
      lastSync: syncResult,
    });
  } catch (err) {
    console.error('VRM link error:', err);
    res.status(500).json({ error: 'Fehler beim Verknüpfen der Installation' });
  }
});

// ─── Victron VRM: Status der Verbindung ──────────────────────────────────────
router.get('/victron/status', authenticateToken, async (req, res) => {
  const { vehicleId } = req.query;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId fehlt' });

  try {
    const result = await pool.query(
      `SELECT id, credentials->>'installationName' as installation_name,
              credentials->>'installationId' as installation_id,
              last_sync_at, last_sync_status, last_sync_error, is_active
       FROM sensor_connections
       WHERE vehicle_id = $1 AND sensor_type = 'victron_vrm' AND user_id = $2`,
      [vehicleId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    const conn = result.rows[0];
    res.json({
      connected: conn.is_active,
      installationName: conn.installation_name,
      installationId: conn.installation_id,
      lastSyncAt: conn.last_sync_at,
      lastSyncStatus: conn.last_sync_status,
      lastSyncError: conn.last_sync_error,
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen des Sensor-Status' });
  }
});

// ─── Victron VRM: Verbindung trennen ─────────────────────────────────────────
router.delete('/victron/disconnect', authenticateToken, async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId fehlt' });

  await pool.query(
    `UPDATE sensor_connections SET is_active = false, updated_at = NOW()
     WHERE vehicle_id = $1 AND sensor_type = 'victron_vrm' AND user_id = $2`,
    [vehicleId, req.user.userId]
  );

  res.json({ success: true, message: 'Victron VRM getrennt' });
});

// ─── Manueller Sync für ein Fahrzeug ─────────────────────────────────────────
router.post('/victron/sync', authenticateToken, async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId fehlt' });

  const connResult = await pool.query(
    `SELECT id, credentials FROM sensor_connections
     WHERE vehicle_id = $1 AND sensor_type = 'victron_vrm' AND user_id = $2 AND is_active = true`,
    [vehicleId, req.user.userId]
  );

  if (connResult.rows.length === 0) {
    return res.status(404).json({ error: 'Keine aktive Victron-Verbindung gefunden' });
  }

  const conn = connResult.rows[0];
  const syncResult = await syncVictronVRM(conn.credentials, vehicleId);

  const status = syncResult.success ? 'ok' : 'error';
  await pool.query(
    `UPDATE sensor_connections SET last_sync_at = NOW(), last_sync_status = $1, last_sync_error = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, syncResult.error || null, conn.id]
  );

  res.json(syncResult);
});

// ─── Kern-Funktion: Victron VRM API abfragen + current_levels aktualisieren ──
export async function syncVictronVRM(credentials, vehicleId) {
  const { accessToken, installationId } = credentials;
  try {
    const diagRes = await fetch(
      `${VRM_BASE}/installations/${installationId}/diagnostics`,
      { headers: { 'x-authorization': `Token ${accessToken}` } }
    );

    if (!diagRes.ok) {
      const errText = await diagRes.text();
      return { success: false, error: `VRM API Fehler ${diagRes.status}: ${errText.slice(0, 100)}` };
    }

    const diag = await diagRes.json();
    const records = diag.records || [];

    // Relevante Werte extrahieren (idDataAttribute IDs aus der VRM API-Dokumentation)
    const soc        = findVrmValue(records, [266]);          // Battery SOC %
    const voltage    = findVrmValue(records, [259]);          // Battery Voltage V
    const current    = findVrmValue(records, [261]);          // Battery Current A
    const solarPower = findVrmValue(records, [790, 855]);     // PV Power W
    const dcPower    = findVrmValue(records, [258]);          // DC System Power W

    if (soc === null) {
      return { success: false, error: 'Batterie-SOC nicht gefunden. Prüfe ob ein BMV/SmartShunt verbunden ist.' };
    }

    // Kapazität aus vehicles-Tabelle holen
    const vehicleResult = await pool.query('SELECT battery_capacity FROM vehicles WHERE id = $1', [vehicleId]);
    const capacity = parseFloat(vehicleResult.rows[0]?.battery_capacity) || 100;
    const powerLevel = (soc / 100) * capacity;

    // current_levels aktualisieren
    await pool.query(
      `UPDATE current_levels
       SET power_level = $1, power_percentage = $2, updated_at = NOW()
       WHERE vehicle_id = $3`,
      [powerLevel.toFixed(2), soc.toFixed(2), vehicleId]
    );

    return {
      success: true,
      soc,
      voltage,
      current,
      solarPower,
      dcPower,
      powerLevel: parseFloat(powerLevel.toFixed(2)),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function findVrmValue(records, attributeIds) {
  for (const id of attributeIds) {
    const record = records.find(r => r.idDataAttribute === id);
    if (record?.rawValue !== undefined && record.rawValue !== null) {
      return parseFloat(record.rawValue);
    }
  }
  return null;
}

export default router;
