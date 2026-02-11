import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function runMigration() {
    console.log('🚀 Starting DaysLeft Migration...\n');
    
    try {
        const schemaPath = path.join(__dirname, 'schema-daysleft.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Reading schema-daysleft.sql...');
        
        await pool.query(schema);
        
        console.log('✅ Migration completed successfully!\n');
        console.log('Created/Updated:');
        console.log('  - vehicles table (extended with resource fields)');
        console.log('  - resource_logs table');
        console.log('  - current_levels table');
        console.log('  - supply_stations table');
        console.log('  - update triggers');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
