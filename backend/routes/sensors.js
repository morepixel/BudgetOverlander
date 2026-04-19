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
    // VRM API: Erst User-ID holen, dann Installationen
    const userRes = await fetch(`${VRM_BASE}/users/me/installations`, {
      headers: { 'x-authorization': `Token ${accessToken}` },
    });

    if (!userRes.ok) {
      return res.status(400).json({ error: 'Ungültiger VRM Access Token. Bitte prüfe deinen Token im VRM Portal.' });
    }

    const userData = await userRes.json();
    const userId = userData.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: 'VRM User-ID konnte nicht ermittelt werden.' });
    }

    // Installationen über User-ID abrufen (liefert vollständige Daten)
    const installRes = await fetch(`${VRM_BASE}/users/${userId}/installations`, {
      headers: { 'x-authorization': `Token ${accessToken}` },
    });

    const installData = await installRes.json();
    const installations = (installData.records || []).map(i => ({
      id: i.idSite,
      name: i.name,
      identifier: i.identifier,
      lastSeen: i.syscreated,
    }));

    res.json({ installations, vrmUserId: userId });
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
    // Stats-Endpoint für Echtzeit-Daten (letzte 15 Minuten)
    const now = Math.floor(Date.now() / 1000);
    const start15min = now - 900; // 15 Minuten zurück
    
    const statsRes = await fetch(
      `${VRM_BASE}/installations/${installationId}/stats?interval=15mins&start=${start15min}&end=${now}`,
      { headers: { 'x-authorization': `Token ${accessToken}` } }
    );

    if (!statsRes.ok) {
      const errText = await statsRes.text();
      return { success: false, error: `VRM API Fehler ${statsRes.status}: ${errText.slice(0, 100)}` };
    }

    const stats = await statsRes.json();
    const totals = stats.totals || {};

    // Batterie-Werte aus Stats (bs = battery SOC, bv = battery voltage)
    const soc = totals.bs !== undefined ? parseFloat(totals.bs) : null;
    const voltage = totals.bv !== undefined ? parseFloat(totals.bv) : null;
    const dcPower = totals.Pdc !== undefined ? parseFloat(totals.Pdc) : null;
    
    // Tages-Ertrag: Stats für den ganzen Tag holen (seit Mitternacht)
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const startOfDay = Math.floor(todayMidnight.getTime() / 1000);
    
    let solarYield = null;
    try {
      const dayStatsRes = await fetch(
        `${VRM_BASE}/installations/${installationId}/stats?interval=hours&start=${startOfDay}&end=${now}`,
        { headers: { 'x-authorization': `Token ${accessToken}` } }
      );
      if (dayStatsRes.ok) {
        const dayStats = await dayStatsRes.json();
        const dayTotals = dayStats.totals || {};
        // total_solar_yield ist in kWh, wir speichern in Wh
        solarYield = dayTotals.total_solar_yield !== undefined 
          ? parseFloat(dayTotals.total_solar_yield) * 1000 
          : null;
      }
    } catch (e) {
      console.error('Solar yield fetch error:', e);
    }

    // Diagnostics für alle Detail-Daten holen
    const diagRes = await fetch(
      `${VRM_BASE}/installations/${installationId}/diagnostics`,
      { headers: { 'x-authorization': `Token ${accessToken}` } }
    );
    
    let freshWater = null;
    let greyWater = null;
    let batteryCurrent = null;
    let batteryTimeToGo = null;
    let batteryConsumedAh = null;
    let batteryChargeCycles = null;
    let pvVoltage = null;
    let pvPower = null;
    let solarYieldYesterday = null;
    let solarMaxPowerToday = null;
    let solarTotalYield = null;
    let acConsumption = null;
    let dcSystemPower = null;
    let chargeState = null;
    let systemState = null;
    
    if (diagRes.ok) {
      const diag = await diagRes.json();
      const records = diag.records || [];
      
      // Helper: Wert nach idDataAttribute finden
      const getValue = (attrId, instance = null) => {
        const r = records.find(rec => 
          rec.idDataAttribute === attrId && (instance === null || rec.instance === instance)
        );
        return r?.rawValue;
      };
      
      // Tank-Sensoren: idDataAttribute 330 = Tank level %
      const tankRecords = records.filter(r => r.idDataAttribute === 330);
      for (const tank of tankRecords) {
        const fluidTypeRecord = records.find(r => 
          r.idDataAttribute === 329 && r.instance === tank.instance
        );
        const fluidType = fluidTypeRecord?.rawValue;
        if (fluidType === 1 || fluidType === '1') {
          freshWater = parseFloat(tank.rawValue);
        } else if (fluidType === 2 || fluidType === '2' || fluidType === 5 || fluidType === '5') {
          greyWater = parseFloat(tank.rawValue);
        }
      }
      
      // Batterie-Daten (BMV/SmartShunt - instance 279 oder 0)
      // SOC aus Diagnostics IMMER bevorzugen (aktueller als Stats-Durchschnitt!)
      const diagSoc = parseFloat(getValue(51)) || parseFloat(getValue(148)); // State of charge %
      if (diagSoc && !isNaN(diagSoc)) {
        soc = diagSoc; // Diagnostics-Wert überschreibt Stats-Wert
      }
      // Spannung aus Diagnostics bevorzugen
      const diagVoltage = parseFloat(getValue(48)) || parseFloat(getValue(144)); // Battery voltage
      if (diagVoltage && !isNaN(diagVoltage)) {
        voltage = diagVoltage;
      }
      
      batteryCurrent = parseFloat(getValue(49)) || parseFloat(getValue(147));  // Current
      batteryTimeToGo = parseFloat(getValue(146)) || parseFloat(getValue(52)); // Time to go (h)
      batteryConsumedAh = parseFloat(getValue(50)) || parseFloat(getValue(145)); // Consumed Ah
      batteryChargeCycles = parseInt(getValue(58)) || null; // Charge cycles
      
      // Solar-Charger Daten (MPPT - instance 277)
      pvVoltage = parseFloat(getValue(86)); // PV voltage
      pvPower = parseFloat(getValue(442));  // PV power
      solarYieldYesterday = parseFloat(getValue(96)) ? parseFloat(getValue(96)) * 1000 : null; // Yield yesterday (kWh -> Wh)
      solarMaxPowerToday = parseInt(getValue(95)) || null; // Max charge power today
      solarTotalYield = parseFloat(getValue(285)) ? parseFloat(getValue(285)) * 1000 : null; // User yield total (kWh -> Wh)
      
      // Ladezustand
      const chargeStateRaw = getValue(85) || getValue(557);
      chargeState = records.find(r => r.idDataAttribute === 85 || r.idDataAttribute === 557)?.formattedValue || null;
      
      // System-Daten (instance 0)
      acConsumption = parseFloat(getValue(131)) || parseFloat(getValue(567)); // AC Consumption
      dcSystemPower = parseFloat(getValue(140)); // DC System
      systemState = records.find(r => r.idDataAttribute === 571)?.formattedValue || null;
    }

    if (soc === null) {
      return { success: false, error: 'Batterie-SOC nicht gefunden. Prüfe ob ein BMV/SmartShunt verbunden ist.' };
    }

    // Kapazität aus vehicles-Tabelle holen
    const vehicleResult = await pool.query(
      'SELECT battery_capacity, water_tank_capacity, grey_water_capacity FROM vehicles WHERE id = $1',
      [vehicleId]
    );
    const vehicle = vehicleResult.rows[0] || {};
    const batteryCapacity = parseFloat(vehicle.battery_capacity) || 100;
    
    // Sichere Werte mit Null-Checks
    const safeSoc = soc !== null && !isNaN(soc) ? soc : null;
    const safeVoltage = voltage !== null && !isNaN(voltage) ? voltage : null;
    const powerLevel = safeSoc !== null ? (safeSoc / 100) * batteryCapacity : null;

    // current_levels aktualisieren (Batterie + Victron-Daten)
    await pool.query(
      `UPDATE current_levels
       SET power_level = COALESCE($1, power_level), 
           power_percentage = COALESCE($2, power_percentage), 
           battery_voltage = COALESCE($3, battery_voltage), 
           dc_power = COALESCE($4, dc_power), 
           solar_yield_today = COALESCE($5, solar_yield_today),
           battery_current = COALESCE($6, battery_current), 
           battery_time_to_go = COALESCE($7, battery_time_to_go), 
           battery_consumed_ah = COALESCE($8, battery_consumed_ah),
           battery_charge_cycles = COALESCE($9, battery_charge_cycles), 
           pv_voltage = COALESCE($10, pv_voltage), 
           pv_power = COALESCE($11, pv_power),
           solar_yield_yesterday = COALESCE($12, solar_yield_yesterday), 
           solar_max_power_today = COALESCE($13, solar_max_power_today), 
           solar_total_yield = COALESCE($14, solar_total_yield),
           ac_consumption = COALESCE($15, ac_consumption), 
           dc_system_power = COALESCE($16, dc_system_power), 
           charge_state = COALESCE($17, charge_state), 
           system_state = COALESCE($18, system_state),
           victron_last_sync = NOW(), updated_at = NOW()
       WHERE vehicle_id = $19`,
      [
        powerLevel, safeSoc, safeVoltage, dcPower, solarYield,
        batteryCurrent, batteryTimeToGo, batteryConsumedAh, batteryChargeCycles,
        pvVoltage, pvPower, solarYieldYesterday, solarMaxPowerToday, solarTotalYield,
        acConsumption, dcSystemPower, chargeState, systemState, vehicleId
      ]
    );

    // Wasser-Tanks aktualisieren wenn vorhanden
    if (freshWater !== null) {
      const waterCapacity = parseFloat(vehicle.water_tank_capacity) || 100;
      const waterLevel = (freshWater / 100) * waterCapacity;
      await pool.query(
        `UPDATE current_levels
         SET water_level = $1, water_percentage = $2, updated_at = NOW()
         WHERE vehicle_id = $3`,
        [waterLevel.toFixed(2), freshWater.toFixed(2), vehicleId]
      );
    }

    if (greyWater !== null) {
      const greyCapacity = parseFloat(vehicle.grey_water_capacity) || 80;
      const greyLevel = (greyWater / 100) * greyCapacity;
      await pool.query(
        `UPDATE current_levels
         SET grey_water_level = $1, grey_water_percentage = $2, updated_at = NOW()
         WHERE vehicle_id = $3`,
        [greyLevel.toFixed(2), greyWater.toFixed(2), vehicleId]
      );
    }

    return {
      success: true,
      soc,
      voltage,
      dcPower,
      solarYield,
      freshWater,
      greyWater,
      powerLevel: parseFloat(powerLevel.toFixed(2)),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default router;
