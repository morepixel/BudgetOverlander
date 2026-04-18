// OneSignal Push Service
import pool from '../database/db-postgres.js';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Push-Nachricht an User senden
export async function sendPushToUser(userId, title, message, data = {}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log('⚠️ OneSignal nicht konfiguriert - Push übersprungen');
    return { success: false, error: 'OneSignal nicht konfiguriert' };
  }
  
  try {
    // Alle aktiven Player-IDs des Users holen
    const result = await pool.query(
      `SELECT onesignal_player_id FROM push_subscriptions 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Keine Push-Subscription gefunden' };
    }
    
    const playerIds = result.rows.map(r => r.onesignal_player_id);
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title, de: title },
        contents: { en: message, de: message },
        data: data,
        ios_badgeType: 'Increase',
        ios_badgeCount: 1
      })
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log(`✅ Push gesendet an User ${userId}: ${title}`);
      return { success: true, data: responseData };
    } else {
      console.error('❌ Push-Fehler:', responseData);
      return { success: false, error: responseData };
    }
  } catch (error) {
    console.error('❌ Push-Service Fehler:', error);
    return { success: false, error: error.message };
  }
}

// Alerts prüfen und Push senden
export async function checkAndTriggerAlerts() {
  console.log('🔔 Prüfe Alerts...');
  
  try {
    // Alle aktiven Alerts mit aktuellen Werten laden
    const alertsResult = await pool.query(`
      SELECT 
        a.*,
        cl.power_percentage,
        cl.water_percentage,
        cl.grey_water_percentage,
        cl.pv_power,
        cl.battery_voltage,
        cl.battery_time_to_go,
        v.name as vehicle_name
      FROM user_alerts a
      JOIN current_levels cl ON cl.vehicle_id = a.vehicle_id
      JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.is_enabled = true
        AND (a.last_triggered_at IS NULL 
             OR a.last_triggered_at < NOW() - (a.cooldown_minutes || ' minutes')::interval)
    `);
    
    let triggeredCount = 0;
    
    for (const alert of alertsResult.rows) {
      let currentValue = null;
      let unit = '%';
      let resourceName = '';
      
      // Aktuellen Wert basierend auf resource_type ermitteln
      switch (alert.resource_type) {
        case 'battery':
        case 'power':
          currentValue = parseFloat(alert.power_percentage) || 0;
          resourceName = 'Batterie';
          break;
        case 'water':
          currentValue = parseFloat(alert.water_percentage) || 0;
          resourceName = 'Wasser';
          break;
        case 'greywater':
          currentValue = parseFloat(alert.grey_water_percentage) || 0;
          resourceName = 'Abwasser';
          break;
        case 'solar':
          currentValue = parseFloat(alert.pv_power) || 0;
          unit = 'W';
          resourceName = 'Solar';
          break;
        case 'voltage':
          currentValue = parseFloat(alert.battery_voltage) || 0;
          unit = 'V';
          resourceName = 'Spannung';
          break;
        default:
          continue;
      }
      
      if (currentValue === null) continue;
      
      // Prüfen ob Grenzwert erreicht
      const threshold = parseFloat(alert.threshold_value);
      let triggered = false;
      
      if (alert.condition === 'below' && currentValue < threshold) {
        triggered = true;
      } else if (alert.condition === 'above' && currentValue > threshold) {
        triggered = true;
      }
      
      if (triggered) {
        // Push senden
        const conditionText = alert.condition === 'below' ? 'unter' : 'über';
        const title = `⚠️ ${resourceName} Alert`;
        const message = `${alert.vehicle_name}: ${resourceName} ist ${conditionText} ${threshold}${unit} (aktuell: ${currentValue.toFixed(1)}${unit})`;
        
        await sendPushToUser(alert.user_id, title, message, {
          type: 'alert',
          alertId: alert.id,
          resourceType: alert.resource_type,
          currentValue,
          threshold
        });
        
        // last_triggered_at aktualisieren
        await pool.query(
          'UPDATE user_alerts SET last_triggered_at = NOW() WHERE id = $1',
          [alert.id]
        );
        
        triggeredCount++;
      }
    }
    
    console.log(`🔔 ${triggeredCount} Alerts ausgelöst`);
    return { checked: alertsResult.rows.length, triggered: triggeredCount };
  } catch (error) {
    console.error('❌ Alert-Prüfung Fehler:', error);
    return { error: error.message };
  }
}
