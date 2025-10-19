# TrailQuest Offgrid - Architektur & Roadmap

## 🎯 High-Level Ziel
Umbau von "Budget Overlander" zu "TrailQuest Offgrid":
- ✅ Budget-First-Routing (Sprit, Maut, Distanz) - **BEREITS VORHANDEN**
- ⏳ Offroad-Tauglichkeits-Score je Segment (OSM-Tags + Steigung)
- ⏳ TrailQuest-Layer: Quests, XP, Badges, Level
- ⏳ Ein-Klick-Tour: 2-Tage-Loop Generator
- ⏳ Offline-Paket: Route + POIs + Tiles, GPX-Export
- ✅ Kein Google-Maps-Scraping (nur OSM/Overpass) - **BEREITS ERFÜLLT**

## 📊 Aktueller Stand (Budget Overlander)

### ✅ Was bereits funktioniert:
1. **Backend (Node.js/Express)**
   - User-Auth (JWT)
   - Fahrzeug-Profile (Breite, Höhe, Gewicht, Verbrauch)
   - Budget-Radar (3 Routenvorschläge basierend auf Budget)
   - Maut-Berechnung (8 EU-Länder)
   - POI-Integration (Wasser, Camping, Entsorgung via Overpass)
   - GPX-Export
   - JSON-basierte Datenbank

2. **Frontend (Vanilla JS/HTML)**
   - Leaflet-Karten
   - Cluster-Visualisierung
   - Route-Planung
   - Budget-Radar UI
   - Fahrzeug-Verwaltung

3. **Daten**
   - 108 Offroad-Cluster (Pyrenäen, Sierra Nevada)
   - OSM-Overpass-Integration
   - OSRM-Routing

### ❌ Was fehlt für TrailQuest:
1. Offroad-Tauglichkeits-Score
2. Höhendaten (SRTM/ASTER)
3. Game-Mechanik (Quests, XP, Badges)
4. Ein-Klick-Tour Generator
5. Offline-Bundle
6. Besseres Routing (GraphHopper/Valhalla statt OSRM)

---

## 🏗️ Service-Architektur (Ziel)

### 1. routing-service
**Technologie:** GraphHopper (OSM-basiert, Offroad-Profile)
- **Input:** Start, Ziel, Fahrzeugprofil, Präferenzen
- **Output:** Route mit Segmenten, Distanz, Zeit, Schwierigkeit
- **Features:**
  - Custom Offroad-Profile (4x4, Bodenfreiheit, Reifentyp)
  - Avoid: Autobahnen, Maut, Städte
  - Prefer: Tracks, Paths, Scenic Routes

### 2. elevation-service
**Technologie:** SRTM/ASTER Tiles (90m/30m Auflösung)
- **Input:** Koordinaten-Array
- **Output:** Höhenprofil, Steigungen, Gefälle
- **Cache:** Raster-Tiles lokal
- **API:** `/api/elevation/profile?coords=lat1,lon1;lat2,lon2`

### 3. pricing-service (erweitert)
**Bestehend:** Maut-Tabellen
**Neu:** 
- Tankerkoenig API (DE)
- Fallback: ENV-Variable für Spritpreis
- HERE Toll API (optional, kostenpflichtig)

### 4. poi-service (erweitert)
**Bestehend:** Overpass-Integration
**Neu:**
- iOverlander-Integration (Lizenz prüfen!)
- Eigene POI-Datenbank (User-generiert)
- POI-Rating & Reviews

### 5. game-service (NEU)
**Datenbank:** Postgres/PostGIS
**Tabellen:**
- `quests` (id, name, description, type, reward_xp, coordinates)
- `user_progress` (user_id, quest_id, status, completed_at)
- `badges` (id, name, icon, requirement)
- `user_badges` (user_id, badge_id, earned_at)

**Quest-Typen:**
- `discover`: Besuche POI (Wasserfall, Aussichtspunkt)
- `distance`: Fahre X km Offroad
- `elevation`: Überwinde X Höhenmeter
- `difficulty`: Fahre Track mit Schwierigkeit > 70
- `photo`: Mache Foto an Location

### 6. export-service (erweitert)
**Bestehend:** GPX-Export
**Neu:**
- Offline-Bundle (ZIP):
  - GPX-Datei
  - POIs (JSON)
  - Raster-Tiles (MBTiles, 50km Radius)
  - Höhenprofil (JSON)

---

## 🔄 Migration-Plan (Budget Overlander → TrailQuest)

### Phase 1: Backend-Erweiterung (Woche 1-2)
1. ✅ Postgres/PostGIS Setup
2. ✅ Datenbank-Migration (JSON → Postgres)
3. ⏳ Game-Service implementieren
4. ⏳ Elevation-Service (SRTM-Integration)
5. ⏳ Offroad-Score-Berechnung

### Phase 2: Routing-Upgrade (Woche 3)
1. GraphHopper-Server aufsetzen
2. OSM-Daten importieren (Europa)
3. Custom Offroad-Profile
4. API-Integration

### Phase 3: Frontend-Umbau (Woche 4-5)
1. Angular/Ionic Setup
2. TrailQuest UI-Komponenten
3. Quest-System
4. Offline-Modus

### Phase 4: Ein-Klick-Tour (Woche 6)
1. Loop-Generator-Algorithmus
2. Budget-optimierte Vorschläge
3. Fahrzeug-spezifische Routen

---

## 📐 API-Verträge (Ziel)

### POST /api/routes/generate-loop
```json
{
  "budget": 300,
  "days": 2,
  "startPoint": { "lat": 42.8, "lon": 0.5 },
  "radius": 100,
  "vehicleId": 1,
  "preferences": {
    "avoidHighways": true,
    "avoidTolls": true,
    "minDifficulty": 40,
    "maxDifficulty": 70
  }
}
```

**Response:**
```json
{
  "routes": [
    {
      "id": "route-1",
      "name": "Pyrenäen Explorer Loop",
      "distance": 180,
      "duration": 8.5,
      "offroad": 120,
      "difficulty": 55,
      "elevation": { "gain": 2400, "loss": 2400 },
      "cost": { "fuel": 85, "toll": 0, "total": 125 },
      "segments": [...],
      "pois": [...],
      "quests": [...]
    }
  ]
}
```

### GET /api/quests/nearby?lat=42.8&lon=0.5&radius=50
```json
{
  "quests": [
    {
      "id": 1,
      "name": "Cascade d'Ars",
      "type": "discover",
      "description": "Besuche den Wasserfall",
      "coordinates": { "lat": 42.75, "lon": 0.52 },
      "reward_xp": 100,
      "difficulty": "easy",
      "completed": false
    }
  ]
}
```

### POST /api/export/offline-bundle
```json
{
  "routeId": "route-1",
  "tileZoom": 14,
  "tileRadius": 50
}
```

**Response:** ZIP-Download

---

## 🛠️ Technologie-Stack

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Datenbank:** PostgreSQL 15 + PostGIS
- **Routing:** GraphHopper (self-hosted)
- **Elevation:** SRTM/ASTER Tiles
- **Auth:** JWT

### Frontend
- **Framework:** Angular 17 + Ionic 7
- **Maps:** Leaflet + Mapbox GL JS
- **Offline:** Service Worker + IndexedDB
- **State:** RxJS

### DevOps
- **Hosting:** Mittwald (bestehend)
- **CI/CD:** GitHub Actions
- **Monitoring:** PM2

---

## 📅 Nächste Schritte (Priorität)

1. **Postgres/PostGIS Setup** (heute)
2. **Game-Service Basis** (heute)
3. **Elevation-Service** (morgen)
4. **Ein-Klick-Tour Generator** (diese Woche)
5. **GraphHopper Setup** (nächste Woche)

---

## 🎮 TrailQuest Features (Details)

### XP-System
- **Discover Quest:** 100 XP
- **Distance (50km Offroad):** 200 XP
- **Elevation (1000m):** 150 XP
- **Difficulty Track (>70):** 300 XP
- **Photo Upload:** 50 XP

### Level
- Level 1: 0-500 XP
- Level 2: 500-1500 XP
- Level 3: 1500-3000 XP
- ...

### Badges
- 🏔️ **Mountain Goat:** 5000m Elevation
- 🌊 **Water Hunter:** 10 Wasserquellen besucht
- 🏕️ **Wild Camper:** 20 Wildcamps
- 🚙 **Offroad King:** 500km Offroad
- 📸 **Photographer:** 50 Fotos hochgeladen

---

## 💾 Datenbank-Schema (Postgres)

### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### vehicles
```sql
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  width DECIMAL(3,2),
  height DECIMAL(3,2),
  weight DECIMAL(4,2),
  four_wheel_drive BOOLEAN,
  ground_clearance DECIMAL(3,2),
  tire_type VARCHAR(50),
  fuel_consumption_onroad DECIMAL(4,1),
  fuel_consumption_offroad DECIMAL(4,1),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### quests
```sql
CREATE TABLE quests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  type VARCHAR(50), -- discover, distance, elevation, difficulty, photo
  coordinates GEOGRAPHY(POINT, 4326),
  reward_xp INTEGER,
  difficulty VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### user_progress
```sql
CREATE TABLE user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  quest_id INTEGER REFERENCES quests(id),
  status VARCHAR(50), -- pending, completed
  completed_at TIMESTAMP,
  UNIQUE(user_id, quest_id)
);
```

### badges
```sql
CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  icon VARCHAR(255),
  requirement TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### user_badges
```sql
CREATE TABLE user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  badge_id INTEGER REFERENCES badges(id),
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
```

---

## 🚀 Quick Start (Development)

1. **Postgres Setup:**
```bash
brew install postgresql postgis
createdb trailquest
psql trailquest -c "CREATE EXTENSION postgis;"
```

2. **Backend:**
```bash
cd backend
npm install pg
npm install graphhopper-js-api-client
node migrate.js  # Migration JSON → Postgres
npm start
```

3. **GraphHopper (optional, später):**
```bash
wget https://graphhopper.com/public/releases/graphhopper-web-8.0.jar
java -jar graphhopper-web-8.0.jar server config.yml
```

4. **SRTM Tiles:**
```bash
mkdir -p data/srtm
# Download von https://srtm.csi.cgiar.org/
```

---

Soll ich mit **Postgres-Setup + Game-Service** starten?
