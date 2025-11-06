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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_trip_plans_user ON trip_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_plans_created ON trip_plans(created_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE users TO overlander;
GRANT ALL PRIVILEGES ON TABLE user_stats TO overlander;
GRANT ALL PRIVILEGES ON TABLE trip_plans TO overlander;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO overlander;
