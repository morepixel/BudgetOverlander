-- Enable PostGIS Extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is installed
SELECT PostGIS_Version();
