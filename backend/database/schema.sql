-- TrailQuest Offgrid Database Schema
-- PostgreSQL 14+

-- Note: PostGIS optional - using lat/lon columns instead

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_level ON users(level);

-- Vehicles table
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  width DECIMAL(3,2),
  height DECIMAL(3,2),
  weight DECIMAL(4,2),
  four_wheel_drive BOOLEAN DEFAULT false,
  ground_clearance DECIMAL(3,2),
  tire_type VARCHAR(50),
  fuel_consumption_onroad DECIMAL(4,1),
  fuel_consumption_offroad DECIMAL(4,1),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_is_default ON vehicles(user_id, is_default);

-- Saved routes table
CREATE TABLE saved_routes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(100),
  cluster_ids TEXT,
  route_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_saved_routes_user_id ON saved_routes(user_id);
CREATE INDEX idx_saved_routes_region ON saved_routes(region);

-- Quests table
CREATE TABLE quests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- discover, distance, elevation, difficulty, photo
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  reward_xp INTEGER DEFAULT 100,
  difficulty VARCHAR(50), -- easy, medium, hard, extreme
  region VARCHAR(100),
  metadata JSONB, -- Additional quest data (e.g., required_distance, required_elevation)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quests_type ON quests(type);
CREATE INDEX idx_quests_region ON quests(region);
CREATE INDEX idx_quests_location ON quests(lat, lon);

-- User progress table
CREATE TABLE user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  quest_id INTEGER REFERENCES quests(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
  progress INTEGER DEFAULT 0, -- 0-100%
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, quest_id)
);

CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_status ON user_progress(user_id, status);

-- Badges table
CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  requirement TEXT,
  requirement_type VARCHAR(50), -- xp, distance, elevation, quests, photos
  requirement_value INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User badges table
CREATE TABLE user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);

-- User stats table (for tracking achievements)
CREATE TABLE user_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_distance_km DECIMAL(10,2) DEFAULT 0,
  total_offroad_km DECIMAL(10,2) DEFAULT 0,
  total_elevation_m INTEGER DEFAULT 0,
  total_quests_completed INTEGER DEFAULT 0,
  total_photos_uploaded INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);

-- Insert default badges
INSERT INTO badges (name, description, icon, requirement_type, requirement_value) VALUES
('🏔️ Mountain Goat', 'Überwinde 5000 Höhenmeter', 'mountain', 'elevation', 5000),
('🌊 Water Hunter', 'Besuche 10 Wasserquellen', 'water', 'quests', 10),
('🏕️ Wild Camper', 'Übernachte 20 Mal wild', 'camping', 'quests', 20),
('🚙 Offroad King', 'Fahre 500km Offroad', 'offroad', 'distance', 500),
('📸 Photographer', 'Lade 50 Fotos hoch', 'camera', 'photos', 50),
('⭐ Explorer', 'Erreiche Level 5', 'star', 'xp', 3000),
('🎯 Quest Master', 'Schließe 50 Quests ab', 'target', 'quests', 50);

-- Insert sample quests (Pyrenäen)
INSERT INTO quests (name, description, type, lat, lon, reward_xp, difficulty, region) VALUES
('Cascade d''Ars', 'Besuche den beeindruckenden Wasserfall Cascade d''Ars', 'discover', 42.75, 0.52, 100, 'easy', 'pyrenees'),
('Col du Tourmalet', 'Bezwinge den legendären Col du Tourmalet', 'discover', 42.91, 0.14, 200, 'hard', 'pyrenees'),
('Pic du Midi', 'Erreiche den Aussichtspunkt Pic du Midi', 'discover', 42.94, 0.14, 150, 'medium', 'pyrenees'),
('Offroad Marathon', 'Fahre 100km Offroad in den Pyrenäen', 'distance', NULL, NULL, 300, 'hard', 'pyrenees'),
('Höhenjäger', 'Überwinde 2000 Höhenmeter an einem Tag', 'elevation', NULL, NULL, 250, 'hard', 'pyrenees');

-- Function to update user level based on XP
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
  -- Level calculation: Level = floor(sqrt(XP / 100))
  NEW.level := FLOOR(SQRT(NEW.xp / 100.0)) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_level
BEFORE UPDATE OF xp ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_level();

-- Function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges()
RETURNS TRIGGER AS $$
DECLARE
  badge_record RECORD;
  user_stat RECORD;
BEGIN
  -- Get user stats
  SELECT * INTO user_stat FROM user_stats WHERE user_id = NEW.user_id;
  
  -- Check all badges
  FOR badge_record IN SELECT * FROM badges LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = NEW.user_id AND badge_id = badge_record.id) THEN
      -- Check requirements
      IF (badge_record.requirement_type = 'elevation' AND user_stat.total_elevation_m >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'distance' AND user_stat.total_offroad_km >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'quests' AND user_stat.total_quests_completed >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'photos' AND user_stat.total_photos_uploaded >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'xp' AND (SELECT xp FROM users WHERE id = NEW.user_id) >= badge_record.requirement_value) THEN
        -- Award badge
        INSERT INTO user_badges (user_id, badge_id) VALUES (NEW.user_id, badge_record.id);
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_badges_on_stats_update
AFTER UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION check_and_award_badges();
