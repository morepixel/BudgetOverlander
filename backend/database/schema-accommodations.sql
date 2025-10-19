-- Accommodations Schema Extension
-- Run this after the main schema.sql

-- Accommodations table
CREATE TABLE IF NOT EXISTS accommodations (
  id SERIAL PRIMARY KEY,
  osm_id VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  type VARCHAR(50), -- stellplatz, campsite, parking, wildcamping
  lat DECIMAL(10, 8) NOT NULL,
  lon DECIMAL(11, 8) NOT NULL,
  price DECIMAL(5, 2) DEFAULT 0, -- 0 = kostenlos
  currency VARCHAR(3) DEFAULT 'EUR',
  rating DECIMAL(2, 1), -- 0-5
  capacity INTEGER,
  features JSONB, -- {electricity: true, water: true, disposal: true, wifi: true, toilet: true, shower: true}
  contact JSONB, -- {phone, email, website}
  opening_hours VARCHAR(255),
  description TEXT,
  source VARCHAR(50) DEFAULT 'osm', -- osm, user, park4night
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodations_location ON accommodations(lat, lon);
CREATE INDEX IF NOT EXISTS idx_accommodations_price ON accommodations(price);
CREATE INDEX IF NOT EXISTS idx_accommodations_type ON accommodations(type);
CREATE INDEX IF NOT EXISTS idx_accommodations_osm_id ON accommodations(osm_id);

-- Accommodation reviews
CREATE TABLE IF NOT EXISTS accommodation_reviews (
  id SERIAL PRIMARY KEY,
  accommodation_id INTEGER REFERENCES accommodations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  visited_date DATE,
  photos JSONB, -- Array of photo URLs
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(accommodation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_reviews_accommodation ON accommodation_reviews(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_reviews_user ON accommodation_reviews(user_id);

-- Function to update accommodation rating
CREATE OR REPLACE FUNCTION update_accommodation_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE accommodations
  SET rating = (
    SELECT AVG(rating)::DECIMAL(2,1)
    FROM accommodation_reviews
    WHERE accommodation_id = NEW.accommodation_id
  )
  WHERE id = NEW.accommodation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_accommodation_rating
AFTER INSERT OR UPDATE ON accommodation_reviews
FOR EACH ROW
EXECUTE FUNCTION update_accommodation_rating();
