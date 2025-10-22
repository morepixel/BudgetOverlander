-- Germany Offroad & Scenic Data Package
-- Pre-calculated data for fast queries without Overpass API
-- Using simple lat/lon instead of PostGIS for compatibility

-- Offroad Tracks Table
CREATE TABLE IF NOT EXISTS germany_offroad_tracks (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255),
    highway VARCHAR(50),
    surface VARCHAR(50),
    tracktype VARCHAR(50),
    difficulty INTEGER DEFAULT 1,
    length_km DECIMAL(10, 3),
    center_lat DECIMAL(10, 7) NOT NULL,
    center_lon DECIMAL(10, 7) NOT NULL,
    geometry_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scenic Viewpoints Table
CREATE TABLE IF NOT EXISTS germany_viewpoints (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255),
    elevation INTEGER,
    description TEXT,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scenic Roads Table
CREATE TABLE IF NOT EXISTS germany_scenic_roads (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255),
    scenic_value VARCHAR(50),
    highway VARCHAR(50),
    length_km DECIMAL(10, 3),
    center_lat DECIMAL(10, 7) NOT NULL,
    center_lon DECIMAL(10, 7) NOT NULL,
    geometry_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Natural Parks & Protected Areas Table
CREATE TABLE IF NOT EXISTS germany_natural_parks (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(255),
    park_type VARCHAR(50), -- 'national_park' or 'nature_reserve'
    description TEXT,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_offroad_tracks_center ON germany_offroad_tracks(center_lat, center_lon);
CREATE INDEX IF NOT EXISTS idx_viewpoints_location ON germany_viewpoints(lat, lon);
CREATE INDEX IF NOT EXISTS idx_scenic_roads_center ON germany_scenic_roads(center_lat, center_lon);
CREATE INDEX IF NOT EXISTS idx_natural_parks_location ON germany_natural_parks(lat, lon);

-- Create regular indexes
CREATE INDEX IF NOT EXISTS idx_offroad_tracks_surface ON germany_offroad_tracks(surface);
CREATE INDEX IF NOT EXISTS idx_offroad_tracks_highway ON germany_offroad_tracks(highway);
CREATE INDEX IF NOT EXISTS idx_scenic_roads_highway ON germany_scenic_roads(highway);
CREATE INDEX IF NOT EXISTS idx_natural_parks_type ON germany_natural_parks(park_type);

-- Function: Find offroad tracks within radius (Haversine distance)
CREATE OR REPLACE FUNCTION find_offroad_tracks_near(
    search_lat DECIMAL,
    search_lon DECIMAL,
    radius_km INTEGER
) RETURNS TABLE (
    id INTEGER,
    osm_id BIGINT,
    name VARCHAR(255),
    highway VARCHAR(50),
    surface VARCHAR(50),
    difficulty INTEGER,
    length_km DECIMAL(10, 3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.osm_id,
        t.name,
        t.highway,
        t.surface,
        t.difficulty,
        t.length_km
    FROM germany_offroad_tracks t
    WHERE (
        6371 * acos(
            cos(radians(search_lat)) * 
            cos(radians(t.center_lat)) * 
            cos(radians(t.center_lon) - radians(search_lon)) + 
            sin(radians(search_lat)) * 
            sin(radians(t.center_lat))
        )
    ) <= radius_km;
END;
$$ LANGUAGE plpgsql;

-- Function: Find scenic points within radius (Haversine distance)
CREATE OR REPLACE FUNCTION find_scenic_points_near(
    search_lat DECIMAL,
    search_lon DECIMAL,
    radius_km INTEGER
) RETURNS TABLE (
    viewpoint_count INTEGER,
    scenic_road_count INTEGER,
    park_count INTEGER,
    viewpoints JSONB,
    scenic_roads JSONB,
    parks JSONB
) AS $$
DECLARE
    v_count INTEGER;
    r_count INTEGER;
    p_count INTEGER;
    v_data JSONB;
    r_data JSONB;
    p_data JSONB;
BEGIN
    -- Count and aggregate viewpoints
    SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object(
        'id', v.osm_id,
        'name', v.name,
        'lat', v.lat,
        'lon', v.lon,
        'elevation', v.elevation,
        'description', v.description
    )), '[]'::jsonb)
    INTO v_count, v_data
    FROM germany_viewpoints v
    WHERE (
        6371 * acos(
            cos(radians(search_lat)) * 
            cos(radians(v.lat)) * 
            cos(radians(v.lon) - radians(search_lon)) + 
            sin(radians(search_lat)) * 
            sin(radians(v.lat))
        )
    ) <= radius_km;
    
    -- Count and aggregate scenic roads
    SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.osm_id,
        'name', r.name,
        'scenicValue', r.scenic_value,
        'highway', r.highway,
        'length_km', r.length_km
    )), '[]'::jsonb)
    INTO r_count, r_data
    FROM germany_scenic_roads r
    WHERE (
        6371 * acos(
            cos(radians(search_lat)) * 
            cos(radians(r.center_lat)) * 
            cos(radians(r.center_lon) - radians(search_lon)) + 
            sin(radians(search_lat)) * 
            sin(radians(r.center_lat))
        )
    ) <= radius_km;
    
    -- Count and aggregate parks
    SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.osm_id,
        'name', p.name,
        'lat', p.lat,
        'lon', p.lon,
        'type', p.park_type,
        'description', p.description
    )), '[]'::jsonb)
    INTO p_count, p_data
    FROM germany_natural_parks p
    WHERE (
        6371 * acos(
            cos(radians(search_lat)) * 
            cos(radians(p.lat)) * 
            cos(radians(p.lon) - radians(search_lon)) + 
            sin(radians(search_lat)) * 
            sin(radians(p.lat))
        )
    ) <= radius_km;
    
    RETURN QUERY SELECT v_count, r_count, p_count, v_data, r_data, p_data;
END;
$$ LANGUAGE plpgsql;

-- Metadata table to track data freshness
CREATE TABLE IF NOT EXISTS germany_data_metadata (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    total_records INTEGER,
    source VARCHAR(100)
);

COMMENT ON TABLE germany_offroad_tracks IS 'Pre-calculated offroad tracks in Germany for fast queries';
COMMENT ON TABLE germany_viewpoints IS 'Pre-calculated scenic viewpoints in Germany';
COMMENT ON TABLE germany_scenic_roads IS 'Pre-calculated scenic/panorama roads in Germany';
COMMENT ON TABLE germany_natural_parks IS 'Pre-calculated national parks and nature reserves in Germany';
