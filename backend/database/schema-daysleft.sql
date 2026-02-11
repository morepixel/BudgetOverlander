-- DaysLeft Database Schema
-- Erweitert die bestehende vehicles-Tabelle und fügt Ressourcen-Tracking hinzu

-- =============================================
-- 1. VEHICLES TABELLE ERWEITERN
-- =============================================

-- Basis-Felder
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS length DECIMAL(4,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Aktive Ressourcen-Kategorien (welche werden getrackt)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS enabled_resources TEXT[] DEFAULT ARRAY['water', 'power', 'fuel', 'gas'];

-- 1. WASSER (Frischwasser)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fresh_water_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS water_consumption_per_day DECIMAL(5,2);

-- 2. STROM
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS battery_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS battery_type VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS solar_power INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS shore_power_charger INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS power_consumption_per_day DECIMAL(5,2);

-- 3. TREIBSTOFF
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_tank_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20) DEFAULT 'diesel';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS auxiliary_tank_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_consumption DECIMAL(4,1);

-- 4. GAS
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gas_capacity DECIMAL(4,1);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gas_consumption_per_day DECIMAL(3,2);

-- 5. ABWASSER (Grauwasser)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS grey_water_capacity INTEGER;

-- 6. TOILETTE (3 Typen: ttt, clesana, chemical)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS toilet_type VARCHAR(50); -- ttt, clesana, chemical

-- TTT (Trockentrenntoilette) - 2 Tanks
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_solid_capacity INTEGER; -- Feststoff-Tank in Liter
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ttt_liquid_capacity INTEGER; -- Pipi-Tank in Liter

-- Clesana - Tüten
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS clesana_bags_capacity INTEGER; -- Anzahl Tüten

-- Chemie-Toilette - Liter
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chemical_tank_capacity INTEGER; -- Tank in Liter

-- Legacy-Felder behalten für Kompatibilität
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS toilet_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS toilet_consumption_per_day DECIMAL(4,1);

-- 7. ESSEN
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS food_capacity INTEGER; -- Tage Vorrat
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS food_consumption_per_day DECIMAL(4,1); -- Personen * Mahlzeiten

-- 8. GETRÄNKE (ohne Wasser)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS drinks_capacity INTEGER; -- Liter oder Flaschen
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS drinks_consumption_per_day DECIMAL(4,1);

-- 9. BIER (Spaß-Kategorie)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS beer_capacity INTEGER; -- Flaschen/Dosen
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS beer_consumption_per_day DECIMAL(4,1);

-- =============================================
-- 2. RESOURCE LOGS TABELLE
-- =============================================

CREATE TABLE IF NOT EXISTS resource_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    resource_type VARCHAR(20) NOT NULL,      -- water, power, fuel, gas
    action VARCHAR(20) NOT NULL,             -- fill, use, set_level
    amount DECIMAL(10,2),                    -- Menge
    unit VARCHAR(10),                        -- L, Ah, kg
    
    current_level DECIMAL(10,2),
    current_percentage DECIMAL(5,2),
    
    location_lat DECIMAL(10,7),
    location_lon DECIMAL(10,7),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_logs_vehicle ON resource_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_resource_logs_user ON resource_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_logs_type ON resource_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_logs_date ON resource_logs(created_at);

-- =============================================
-- 3. CURRENT LEVELS TABELLE (Cache für aktuelle Füllstände)
-- =============================================

CREATE TABLE IF NOT EXISTS current_levels (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- 1. Wasser
    water_level DECIMAL(10,2),
    water_percentage DECIMAL(5,2),
    water_days_remaining DECIMAL(4,1),
    
    -- 2. Strom
    power_level DECIMAL(10,2),
    power_percentage DECIMAL(5,2),
    power_days_remaining DECIMAL(4,1),
    
    -- 3. Treibstoff
    fuel_level DECIMAL(10,2),
    fuel_percentage DECIMAL(5,2),
    fuel_km_remaining DECIMAL(6,1),
    
    -- 4. Gas
    gas_level DECIMAL(10,2),
    gas_percentage DECIMAL(5,2),
    gas_days_remaining DECIMAL(4,1),
    
    -- 5. Abwasser (hier zählt es HOCH - je voller desto schlechter)
    greywater_level DECIMAL(10,2),
    greywater_percentage DECIMAL(5,2),
    greywater_days_remaining DECIMAL(4,1),
    
    -- 6. Toilette - je nach Typ unterschiedlich
    toilet_level DECIMAL(10,2),
    toilet_percentage DECIMAL(5,2),
    toilet_uses_remaining DECIMAL(6,1),
    
    -- TTT spezifisch
    ttt_solid_level DECIMAL(10,2),
    ttt_solid_percentage DECIMAL(5,2),
    ttt_liquid_level DECIMAL(10,2),
    ttt_liquid_percentage DECIMAL(5,2),
    
    -- Clesana spezifisch
    clesana_bags_remaining INTEGER,
    
    -- Chemie spezifisch
    chemical_level DECIMAL(10,2),
    chemical_percentage DECIMAL(5,2),
    
    -- 7. Essen
    food_level DECIMAL(10,2),
    food_percentage DECIMAL(5,2),
    food_days_remaining DECIMAL(4,1),
    
    -- 8. Getränke
    drinks_level DECIMAL(10,2),
    drinks_percentage DECIMAL(5,2),
    drinks_days_remaining DECIMAL(4,1),
    
    -- 9. Bier
    beer_level DECIMAL(10,2),
    beer_percentage DECIMAL(5,2),
    beer_days_remaining DECIMAL(4,1),
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Neue Spalten hinzufügen falls Tabelle bereits existiert
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS greywater_level DECIMAL(10,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS greywater_percentage DECIMAL(5,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS greywater_days_remaining DECIMAL(4,1);

ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS toilet_level DECIMAL(10,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS toilet_percentage DECIMAL(5,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS toilet_uses_remaining DECIMAL(6,1);

ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS food_level DECIMAL(10,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS food_percentage DECIMAL(5,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS food_days_remaining DECIMAL(4,1);

ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS drinks_level DECIMAL(10,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS drinks_percentage DECIMAL(5,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS drinks_days_remaining DECIMAL(4,1);

ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS beer_level DECIMAL(10,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS beer_percentage DECIMAL(5,2);
ALTER TABLE current_levels ADD COLUMN IF NOT EXISTS beer_days_remaining DECIMAL(4,1);

CREATE INDEX IF NOT EXISTS idx_current_levels_vehicle ON current_levels(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_current_levels_user ON current_levels(user_id);

-- =============================================
-- 4. CUSTOM RESOURCES TABELLE (Benutzerdefinierte Ressourcen)
-- =============================================

CREATE TABLE IF NOT EXISTS custom_resources (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,              -- z.B. "Hundefutter", "Medikamente"
    icon VARCHAR(10) DEFAULT '📦',            -- Emoji für Anzeige
    unit VARCHAR(20) DEFAULT 'Stück',        -- Einheit: Stück, kg, L, Tage
    capacity DECIMAL(10,2) NOT NULL,         -- Maximale Kapazität
    consumption_per_day DECIMAL(6,2),        -- Verbrauch pro Tag (optional)
    current_level DECIMAL(10,2),             -- Aktueller Stand
    current_percentage DECIMAL(5,2),         -- Prozent
    is_inverted BOOLEAN DEFAULT false,       -- true = je voller desto schlechter (wie Abwasser)
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_resources_vehicle ON custom_resources(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_custom_resources_user ON custom_resources(user_id);

-- =============================================
-- 5. POWER CONSUMERS TABELLE (Verbraucher für Batterie)
-- =============================================

CREATE TABLE IF NOT EXISTS power_consumers (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,              -- z.B. "Kühlschrank", "Licht", "Laptop"
    icon VARCHAR(10) DEFAULT '⚡',            -- Emoji für Anzeige
    consumption_ah DECIMAL(6,2) NOT NULL,    -- Verbrauch pro Tag in Ah
    is_active BOOLEAN DEFAULT true,          -- Ist der Verbraucher aktiv?
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_power_consumers_vehicle ON power_consumers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_power_consumers_user ON power_consumers(user_id);

-- =============================================
-- 5. SUPPLY STATIONS TABELLE (Versorgungsstellen)
-- =============================================

CREATE TABLE IF NOT EXISTS supply_stations (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    
    name VARCHAR(200),
    type VARCHAR(50) NOT NULL,               -- water, dump, fuel, lpg, electric
    
    lat DECIMAL(10,7) NOT NULL,
    lon DECIMAL(10,7) NOT NULL,
    
    is_free BOOLEAN,
    price DECIMAL(6,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    
    opening_hours TEXT,
    
    has_fresh_water BOOLEAN DEFAULT false,
    has_grey_water_dump BOOLEAN DEFAULT false,
    has_black_water_dump BOOLEAN DEFAULT false,
    has_electricity BOOLEAN DEFAULT false,
    has_lpg BOOLEAN DEFAULT false,
    has_diesel BOOLEAN DEFAULT false,
    
    rating DECIMAL(2,1),
    rating_count INTEGER DEFAULT 0,
    last_verified TIMESTAMP,
    verified_by INTEGER REFERENCES users(id),
    
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_stations_location ON supply_stations(lat, lon);
CREATE INDEX IF NOT EXISTS idx_supply_stations_type ON supply_stations(type);

-- =============================================
-- 5. TRIGGER FÜR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_current_levels_updated_at ON current_levels;
CREATE TRIGGER update_current_levels_updated_at
    BEFORE UPDATE ON current_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_supply_stations_updated_at ON supply_stations;
CREATE TRIGGER update_supply_stations_updated_at
    BEFORE UPDATE ON supply_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
