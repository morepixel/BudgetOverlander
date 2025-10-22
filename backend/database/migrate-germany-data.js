// Migration: Setup Germany Data Tables with PostGIS
import pool from './db-postgres.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Erstelle Germany Data Tables (ohne PostGIS)...');
    const schema = fs.readFileSync(join(__dirname, 'schema-germany-data.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Germany Data Tables erstellt');
    
    console.log('\n📦 Nächster Schritt: Daten importieren mit:');
    console.log('   node backend/scripts/import-germany-data.js');
    console.log('\n⚠️  WICHTIG: Import dauert ca. 5-10 Minuten (Overpass Rate Limits)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
