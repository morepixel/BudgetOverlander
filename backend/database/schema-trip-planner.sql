-- Trip Planner Schema Extension

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

CREATE INDEX IF NOT EXISTS idx_trip_plans_user ON trip_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_plans_created ON trip_plans(created_at);
