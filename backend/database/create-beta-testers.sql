-- Beta Testers Tabelle erstellen
-- Dieses Skript auf dem Server ausführen

CREATE TABLE IF NOT EXISTS beta_testers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    registered_at TIMESTAMP DEFAULT NOW(),
    confirmed BOOLEAN DEFAULT false,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_beta_testers_email ON beta_testers(email);

-- Prüfen ob Tabelle erstellt wurde
SELECT 'beta_testers Tabelle erstellt' AS status;
