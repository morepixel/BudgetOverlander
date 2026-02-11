-- Initialize all required database tables

-- Users table (already exists)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User stats table
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_distance_km DECIMAL(10,2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip plans table
CREATE TABLE IF NOT EXISTS trip_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_location JSONB NOT NULL,
    end_location JSONB NOT NULL,
    start_date DATE,
    end_date DATE,
    preferences JSONB,
    route_data JSONB,
    days JSONB,
    total_distance DECIMAL(10, 2),
    total_duration DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Premium fields for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_since TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_type VARCHAR(50);

-- Premium transactions table
CREATE TABLE IF NOT EXISTS premium_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    premium_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_provider VARCHAR(50),
    payment_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium);
CREATE INDEX IF NOT EXISTS idx_trip_plans_user ON trip_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_plans_created ON trip_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_premium_transactions_user ON premium_transactions(user_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE users TO overlander;
GRANT ALL PRIVILEGES ON TABLE user_stats TO overlander;
GRANT ALL PRIVILEGES ON TABLE trip_plans TO overlander;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO overlander;
