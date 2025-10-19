// Migration script: JSON → PostgreSQL
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool, { initializeDatabase } from './db-postgres.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log('🚀 Starting migration from JSON to PostgreSQL...');
    
    // Initialize database schema
    await initializeDatabase();
    
    // Load JSON data
    const jsonPath = join(__dirname, '..', 'database.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.log('⚠️  No database.json found, skipping migration');
      return;
    }
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Migrate users
    console.log('👥 Migrating users...');
    for (const user of jsonData.users || []) {
      await pool.query(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
        [user.id, user.email, user.password, user.created_at || new Date().toISOString()]
      );
      
      // Initialize user stats
      await pool.query(
        'INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );
    }
    console.log(`✅ Migrated ${jsonData.users?.length || 0} users`);
    
    // Migrate vehicles
    console.log('🚗 Migrating vehicles...');
    for (const vehicle of jsonData.vehicles || []) {
      await pool.query(
        `INSERT INTO vehicles (
          id, user_id, name, width, height, weight, 
          four_wheel_drive, ground_clearance, tire_type, 
          fuel_consumption_onroad, fuel_consumption_offroad, is_default, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING`,
        [
          vehicle.id,
          vehicle.user_id,
          vehicle.name,
          vehicle.width,
          vehicle.height,
          vehicle.weight,
          vehicle.four_wheel_drive,
          vehicle.ground_clearance,
          vehicle.tire_type,
          vehicle.fuel_consumption_onroad,
          vehicle.fuel_consumption_offroad,
          vehicle.is_default,
          vehicle.created_at || new Date().toISOString()
        ]
      );
    }
    console.log(`✅ Migrated ${jsonData.vehicles?.length || 0} vehicles`);
    
    // Migrate saved routes
    console.log('🗺️  Migrating saved routes...');
    for (const route of jsonData.saved_routes || []) {
      await pool.query(
        `INSERT INTO saved_routes (
          id, user_id, name, region, cluster_ids, route_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING`,
        [
          route.id,
          route.user_id,
          route.name,
          route.region,
          route.cluster_ids,
          JSON.stringify(route.route_data),
          route.created_at || new Date().toISOString()
        ]
      );
    }
    console.log(`✅ Migrated ${jsonData.saved_routes?.length || 0} saved routes`);
    
    // Update sequences
    console.log('🔢 Updating sequences...');
    await pool.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))`);
    await pool.query(`SELECT setval('vehicles_id_seq', COALESCE((SELECT MAX(id) FROM vehicles), 1))`);
    await pool.query(`SELECT setval('saved_routes_id_seq', COALESCE((SELECT MAX(id) FROM saved_routes), 1))`);
    
    console.log('✅ Migration completed successfully!');
    
    // Backup JSON file
    const backupPath = jsonPath + '.backup';
    fs.copyFileSync(jsonPath, backupPath);
    console.log(`📦 JSON backup saved to: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrate();
