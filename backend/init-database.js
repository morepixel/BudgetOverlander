// Datenbank-Initialisierung für Hetzner Server
import { initializeDatabase } from './database/db-postgres.js';
import pool from './database/db-postgres.js';

async function init() {
  try {
    console.log('🗄️ Starte Datenbank-Initialisierung...');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Datenbankverbindung erfolgreich');
    client.release();
    
    // Initialize schema
    await initializeDatabase();
    
    console.log('✅ Datenbank erfolgreich initialisiert!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler bei der Datenbank-Initialisierung:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

init();
