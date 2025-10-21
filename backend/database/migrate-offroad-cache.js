// Migration: Create offroad_cache table
import pool from './db-postgres.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Running offroad_cache migration...');
    
    const schema = fs.readFileSync(join(__dirname, 'schema-offroad-cache.sql'), 'utf8');
    await pool.query(schema);
    
    console.log('✅ offroad_cache table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
