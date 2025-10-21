-- Offroad Track Cache Schema
-- Speichert Overpass API Ergebnisse für schnellere Wiederverwendung

CREATE TABLE IF NOT EXISTS offroad_cache (
    id SERIAL PRIMARY KEY,
    region_key VARCHAR(100) UNIQUE NOT NULL, -- z.B. "lat_48.0_lon_7.8_radius_50"
    center_lat DECIMAL(10, 7) NOT NULL,
    center_lon DECIMAL(10, 7) NOT NULL,
    radius_km INTEGER NOT NULL,
    tracks JSONB NOT NULL, -- Array von Track-Objekten
    total_km DECIMAL(10, 2) NOT NULL,
    avg_difficulty INTEGER NOT NULL,
    track_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_region_key ON offroad_cache(region_key);
CREATE INDEX IF NOT EXISTS idx_center_coords ON offroad_cache(center_lat, center_lon);
CREATE INDEX IF NOT EXISTS idx_expires_at ON offroad_cache(expires_at);

-- Funktion: Finde Cache-Eintrag in der Nähe
CREATE OR REPLACE FUNCTION find_nearby_cache(
    search_lat DECIMAL(10, 7),
    search_lon DECIMAL(10, 7),
    search_radius_km INTEGER,
    max_distance_km INTEGER DEFAULT 10
) RETURNS TABLE (
    id INTEGER,
    region_key VARCHAR(100),
    tracks JSONB,
    total_km DECIMAL(10, 2),
    avg_difficulty INTEGER,
    track_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.region_key,
        c.tracks,
        c.total_km,
        c.avg_difficulty,
        c.track_count
    FROM offroad_cache c
    WHERE 
        c.expires_at > NOW()
        AND c.radius_km >= search_radius_km
        AND (
            -- Haversine-Distanz in km
            6371 * acos(
                cos(radians(search_lat)) * 
                cos(radians(c.center_lat)) * 
                cos(radians(c.center_lon) - radians(search_lon)) + 
                sin(radians(search_lat)) * 
                sin(radians(c.center_lat))
            )
        ) <= max_distance_km
    ORDER BY (
        6371 * acos(
            cos(radians(search_lat)) * 
            cos(radians(c.center_lat)) * 
            cos(radians(c.center_lon) - radians(search_lon)) + 
            sin(radians(search_lat)) * 
            sin(radians(c.center_lat))
        )
    ) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Cleanup-Job: Lösche abgelaufene Einträge
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS void AS $$
BEGIN
    DELETE FROM offroad_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Kommentar
COMMENT ON TABLE offroad_cache IS 'Cache für Overpass API Offroad-Track-Daten. Reduziert API-Calls und verbessert Performance.';
