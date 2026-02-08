# Offgrid Compass - Technisches Setup & TODO

> Basierend auf der Budget Overlander Infrastruktur

---

## 🛠️ Technisches Setup

### Was wir von Budget Overlander wiederverwenden

| Komponente | Status | Anpassungen |
|------------|--------|-------------|
| **Backend (Node.js/Express)** | ✅ Übernehmen | Neue Routes für Ressourcen |
| **PostgreSQL Datenbank** | ✅ Übernehmen | Neue Tabellen |
| **JWT Auth** | ✅ Übernehmen | Unverändert |
| **Hetzner Server** | ✅ Übernehmen | Gleicher Server |
| **GitHub Actions Deploy** | ✅ Übernehmen | Workflow anpassen |
| **Leaflet Maps** | ✅ Übernehmen | Neue Layer |
| **Geocoding Utils** | ✅ Übernehmen | Unverändert |

### Neue Komponenten

| Komponente | Technologie | Priorität |
|------------|-------------|-----------|
| **Fahrzeug-Profile** | PostgreSQL + API | Phase 1 |
| **Ressourcen-Tracking** | PostgreSQL + API | Phase 1 |
| **Dashboard UI** | HTML/CSS/JS (wie bisher) | Phase 1 |
| **Versorgungsstellen-API** | OSM Overpass + eigene DB | Phase 2 |
| **Offline-Storage** | IndexedDB (Frontend) | Phase 2 |
| **Push-Notifications** | Web Push API | Phase 3 |
| **Bluetooth Sensoren** | Web Bluetooth API | Phase 3 |
| **Wetter-Integration** | OpenWeatherMap API | Phase 3 |

---

## 📁 Projekt-Struktur

```
/offgrid-compass/                    (oder in /Budget Overlander/ integriert)
├── backend/
│   ├── server.js                    ✅ Vorhanden (erweitern)
│   ├── database.js                  ✅ Vorhanden (erweitern)
│   ├── routes/
│   │   ├── auth.js                  ✅ Vorhanden
│   │   ├── vehicles.js              🆕 NEU - Fahrzeug-Profile
│   │   ├── resources.js             🆕 NEU - Ressourcen-Tracking
│   │   ├── supply-stations.js       🆕 NEU - Versorgungsstellen
│   │   └── weather.js               🆕 NEU - Wetter (Phase 3)
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_vehicles.sql     🆕 NEU
│   │   │   ├── 002_resources.sql    🆕 NEU
│   │   │   └── 003_supply_stations.sql 🆕 NEU
│   │   └── seed/
│   │       └── supply_stations.sql  🆕 NEU - Initiale Daten
│   └── utils/
│       ├── overpass.js              ✅ Vorhanden (erweitern)
│       └── calculations.js          🆕 NEU - Verbrauchs-Berechnungen
│
├── frontend/
│   ├── index.html                   🔄 Redirect zu App
│   ├── app.html                     🆕 NEU - Hauptapp
│   ├── css/
│   │   └── offgrid.css              🆕 NEU - App-Styles
│   ├── js/
│   │   ├── api.js                   ✅ Vorhanden (erweitern)
│   │   ├── app.js                   🆕 NEU - App-Logik
│   │   ├── dashboard.js             🆕 NEU - Dashboard-UI
│   │   ├── vehicle-setup.js         🆕 NEU - Fahrzeug-Setup
│   │   ├── map.js                   🆕 NEU - Karten-Logik
│   │   └── offline.js               🆕 NEU - IndexedDB (Phase 2)
│   └── manifest.json                ✅ Vorhanden (anpassen)
│
└── docs/
    └── API.md                       🆕 NEU - API-Dokumentation
```

---

## 🗄️ Datenbank-Schema

### Tabelle: vehicles (Fahrzeug-Profile)

```sql
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,              -- "Mein Fuso"
    
    -- Wasser
    fresh_water_capacity INTEGER,            -- Liter
    grey_water_capacity INTEGER,             -- Liter
    water_consumption_per_day DECIMAL(5,2),  -- Liter/Tag (gelernt)
    
    -- Strom
    battery_capacity INTEGER,                -- Ah
    battery_type VARCHAR(50),                -- LiFePO4, AGM, etc.
    solar_power INTEGER,                     -- Wp
    shore_power_charger INTEGER,             -- A
    power_consumption_per_day DECIMAL(5,2),  -- Ah/Tag (gelernt)
    
    -- Kraftstoff
    fuel_tank_capacity INTEGER,              -- Liter
    fuel_type VARCHAR(20),                   -- Diesel, Benzin, LPG
    fuel_consumption DECIMAL(4,1),           -- L/100km
    auxiliary_tank_capacity INTEGER,         -- Liter
    
    -- Gas
    gas_capacity DECIMAL(4,1),               -- kg (z.B. 2x11kg = 22)
    gas_consumption_per_day DECIMAL(3,2),    -- kg/Tag
    
    -- Fahrzeug-Maße (für spätere Big Rig Integration)
    height DECIMAL(3,2),                     -- Meter
    width DECIMAL(3,2),                      -- Meter
    length DECIMAL(4,2),                     -- Meter
    weight INTEGER,                          -- kg
    
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabelle: resource_logs (Ressourcen-Einträge)

```sql
CREATE TABLE resource_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id),
    user_id INTEGER REFERENCES users(id),
    
    resource_type VARCHAR(20) NOT NULL,      -- water, power, fuel, gas
    action VARCHAR(20) NOT NULL,             -- fill, use, set_level
    amount DECIMAL(10,2),                    -- Menge
    unit VARCHAR(10),                        -- L, Ah, kg
    
    -- Aktueller Stand nach Aktion
    current_level DECIMAL(10,2),
    current_percentage DECIMAL(5,2),
    
    -- Kontext
    location_lat DECIMAL(10,7),
    location_lon DECIMAL(10,7),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabelle: supply_stations (Versorgungsstellen)

```sql
CREATE TABLE supply_stations (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,                           -- OpenStreetMap ID
    
    name VARCHAR(200),
    type VARCHAR(50) NOT NULL,               -- water, dump, fuel, lpg, electric
    
    lat DECIMAL(10,7) NOT NULL,
    lon DECIMAL(10,7) NOT NULL,
    
    -- Details
    is_free BOOLEAN,
    price DECIMAL(6,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Öffnungszeiten
    opening_hours TEXT,
    
    -- Ausstattung (für Kombistationen)
    has_fresh_water BOOLEAN DEFAULT false,
    has_grey_water_dump BOOLEAN DEFAULT false,
    has_black_water_dump BOOLEAN DEFAULT false,
    has_electricity BOOLEAN DEFAULT false,
    has_lpg BOOLEAN DEFAULT false,
    has_diesel BOOLEAN DEFAULT false,
    
    -- Community-Daten
    rating DECIMAL(2,1),
    rating_count INTEGER DEFAULT 0,
    last_verified TIMESTAMP,
    verified_by INTEGER REFERENCES users(id),
    
    -- Metadaten
    source VARCHAR(50),                      -- osm, park4night, user
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supply_stations_location ON supply_stations(lat, lon);
CREATE INDEX idx_supply_stations_type ON supply_stations(type);
```

### Tabelle: current_levels (Aktuelle Füllstände - Cache)

```sql
CREATE TABLE current_levels (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) UNIQUE,
    user_id INTEGER REFERENCES users(id),
    
    water_level DECIMAL(10,2),               -- Liter
    water_percentage DECIMAL(5,2),
    water_days_remaining DECIMAL(4,1),
    
    power_level DECIMAL(10,2),               -- Ah
    power_percentage DECIMAL(5,2),
    power_days_remaining DECIMAL(4,1),
    
    fuel_level DECIMAL(10,2),                -- Liter
    fuel_percentage DECIMAL(5,2),
    fuel_km_remaining DECIMAL(6,1),
    
    gas_level DECIMAL(10,2),                 -- kg
    gas_percentage DECIMAL(5,2),
    gas_days_remaining DECIMAL(4,1),
    
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🌐 API Endpoints

### Vehicles (Fahrzeuge)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/vehicles` | Alle Fahrzeuge des Users |
| GET | `/api/vehicles/:id` | Ein Fahrzeug |
| POST | `/api/vehicles` | Fahrzeug anlegen |
| PUT | `/api/vehicles/:id` | Fahrzeug aktualisieren |
| DELETE | `/api/vehicles/:id` | Fahrzeug löschen |
| POST | `/api/vehicles/:id/set-default` | Als Standard setzen |

### Resources (Ressourcen)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/resources/current` | Aktuelle Füllstände |
| POST | `/api/resources/log` | Eintrag hinzufügen |
| GET | `/api/resources/history` | Verlauf |
| GET | `/api/resources/stats` | Statistiken (Durchschnittsverbrauch) |

### Supply Stations (Versorgungsstellen)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/supply-stations` | Stationen in Bereich (bbox) |
| GET | `/api/supply-stations/:id` | Eine Station |
| POST | `/api/supply-stations` | Station melden |
| PUT | `/api/supply-stations/:id` | Station aktualisieren |
| POST | `/api/supply-stations/:id/verify` | Station verifizieren |
| POST | `/api/supply-stations/:id/rate` | Station bewerten |
| GET | `/api/supply-stations/nearest` | Nächste Station (nach Typ) |

---

## ✅ TODO-Liste

### Phase 1: MVP Basics (Woche 1-2)

#### 1.1 Backend Setup
- [ ] Neue Datenbank-Tabellen erstellen (vehicles, resource_logs, current_levels)
- [ ] Route: `/api/vehicles` - CRUD für Fahrzeuge
- [ ] Route: `/api/resources/current` - Aktuelle Füllstände
- [ ] Route: `/api/resources/log` - Eintrag hinzufügen
- [ ] Berechnung: Tage verbleibend basierend auf Verbrauch

#### 1.2 Frontend: Fahrzeug-Setup
- [ ] Neue Seite: `vehicle-setup.html`
- [ ] Formular: Wasser-Setup (Tank-Größe, Verbrauch)
- [ ] Formular: Strom-Setup (Batterie, Solar)
- [ ] Formular: Kraftstoff-Setup (Tank, Verbrauch)
- [ ] Formular: Gas-Setup (Flaschen, Verbrauch)
- [ ] Speichern in Datenbank

#### 1.3 Frontend: Dashboard
- [ ] Neue Seite: `dashboard.html` (Hauptseite)
- [ ] Komponente: Wasser-Anzeige (Balken + Tage verbleibend)
- [ ] Komponente: Strom-Anzeige
- [ ] Komponente: Kraftstoff-Anzeige (+ km Reichweite)
- [ ] Komponente: Gas-Anzeige
- [ ] Quick-Actions: "Wasser aufgefüllt", "Getankt", etc.

#### 1.4 Frontend: Ressourcen-Eingabe
- [ ] Modal: "Ressource hinzufügen/entnehmen"
- [ ] Slider für Füllstand-Anpassung
- [ ] Schnell-Buttons: "+10L", "+50L", "Voll", etc.

---

### Phase 2: Karte & Versorgungsstellen (Woche 3-4)

#### 2.1 Backend: Versorgungsstellen
- [ ] Datenbank-Tabelle: supply_stations
- [ ] OSM-Import: Wasserstellen, Tankstellen, Entsorgung
- [ ] Route: `/api/supply-stations` - Stationen abrufen
- [ ] Route: `/api/supply-stations/nearest` - Nächste Station

#### 2.2 Frontend: Karte
- [ ] Neue Seite: `map.html` (oder Tab in Dashboard)
- [ ] Leaflet-Karte mit Fullscreen
- [ ] Marker: Versorgungsstellen (Icons nach Typ)
- [ ] Filter: Nur Wasser, Nur Diesel, etc.
- [ ] Popup: Details + Navigation

#### 2.3 Smart Features
- [ ] Warnung: "Wasser wird in X Tagen knapp"
- [ ] Vorschlag: "Nächste Wasserstation: 12km"
- [ ] Routing zur nächsten Station

---

### Phase 3: Offline & Notifications (Woche 5-6)

#### 3.1 Offline-Funktionalität
- [ ] IndexedDB: Fahrzeug-Daten lokal speichern
- [ ] IndexedDB: Ressourcen-Logs lokal speichern
- [ ] Sync: Lokale Daten mit Server synchronisieren
- [ ] Offline-Karten: Tiles cachen (begrenzt)

#### 3.2 Push-Notifications
- [ ] Service Worker registrieren
- [ ] Push-Permission anfragen
- [ ] Notification: "Wasser unter 20%"
- [ ] Notification: "Du bist in der Nähe einer Wasserstation"

---

### Phase 4: Sensoren & Wetter (Woche 7-8)

#### 4.1 Bluetooth-Sensoren
- [ ] Web Bluetooth API implementieren
- [ ] Victron BLE Protokoll (Batterie)
- [ ] Generische Tank-Sensoren
- [ ] Auto-Update bei Verbindung

#### 4.2 Wetter-Integration
- [ ] OpenWeatherMap API anbinden
- [ ] Solar-Ertrag schätzen basierend auf Wetter
- [ ] Warnung bei Regen: "Weniger Solar erwartet"
- [ ] Gas-Verbrauch anpassen bei Kälte

---

### Phase 5: Community & Polish (Woche 9-10)

#### 5.1 Community-Features
- [ ] Station melden (User-generated)
- [ ] Station bewerten
- [ ] Station verifizieren
- [ ] Kommentare

#### 5.2 Statistiken
- [ ] Durchschnittsverbrauch über Zeit
- [ ] Grafiken: Verbrauch pro Woche/Monat
- [ ] Tipps: "Du verbrauchst mehr Wasser als üblich"

#### 5.3 Polish
- [ ] Onboarding-Flow für neue User
- [ ] Responsive Design optimieren
- [ ] Performance-Optimierung
- [ ] Error-Handling verbessern

---

## 🎯 MVP Definition (Phase 1)

Das MVP ist fertig wenn:

1. ✅ User kann Fahrzeug-Profil anlegen
2. ✅ User sieht Dashboard mit 4 Ressourcen-Balken
3. ✅ User kann Füllstände manuell aktualisieren
4. ✅ App berechnet "Tage/km verbleibend"
5. ✅ Daten werden in Datenbank gespeichert

**Ohne:**
- ❌ Karte (Phase 2)
- ❌ Offline (Phase 3)
- ❌ Sensoren (Phase 4)
- ❌ Community (Phase 5)

---

## 🚀 Sofort starten

### Schritt 1: Datenbank-Migration

```bash
cd /Users/l2sr6t/Documents/Projekte/Budget\ Overlander/backend
# Migration-SQL ausführen (siehe oben)
```

### Schritt 2: Backend-Routes erstellen

```bash
# Neue Dateien:
# - routes/vehicles.js
# - routes/resources.js
```

### Schritt 3: Frontend-Seiten erstellen

```bash
# Neue Dateien:
# - frontend/offgrid.html (Hauptseite)
# - frontend/js/offgrid-app.js
# - frontend/css/offgrid.css
```

---

*Erstellt: Februar 2026*
*Status: Bereit zur Umsetzung*
