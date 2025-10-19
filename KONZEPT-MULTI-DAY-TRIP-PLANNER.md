# Multi-Day Trip Planner - Konzept

## 🎯 Ziel
Automatische Routenplanung von Heimatort zu Ziel-Region mit:
- Tagesetappen basierend auf km-Limite & Geschwindigkeit
- Übernachtungen an Wohnmobilstellplätzen
- Kostenoptimierung (kostenlose vs. kostenpflichtige Stellplätze)
- Offroad-Highlights entlang der Route

## 📊 Input-Parameter

### 1. Startpunkt
- Heimatort (Adresse oder Koordinaten)
- Start-Datum

### 2. Zielpunkt
- Ziel-Region (z.B. Pyrenäen)
- Optional: Rückreise-Planung

### 3. Tages-Präferenzen
- **Max. km/Tag:** 250-500 km
- **Durchschnittsgeschwindigkeit:** 
  - Autobahn: 80-100 km/h
  - Landstraße: 60-80 km/h
  - Offroad: 30-50 km/h
- **Fahrtzeit/Tag:** 4-8 Stunden
- **Früheste Abfahrt:** z.B. 08:00
- **Späteste Ankunft:** z.B. 18:00

### 4. Übernachtungs-Präferenzen
- **Typ:** 
  - Kostenlose Stellplätze (Priorität)
  - Kostenpflichtige Stellplätze (< X €)
  - Wildcamping (legal)
  - Campingplätze (Komfort)
- **Budget/Nacht:** 0-50 €
- **Ausstattung:** 
  - Ver-/Entsorgung
  - Strom
  - Wasser
  - WC/Dusche

### 5. Route-Präferenzen
- **Maut vermeiden:** Ja/Nein
- **Autobahn:** Ja/Nein/Gemischt
- **Offroad-Anteil:** 0-100%
- **Highlights:** Scenic Routes, POIs, Quests

## 🗺️ Datenquellen für Wohnmobilstellplätze

### Option 1: **Park4Night** (Empfohlen)
- **API:** Ja (inoffiziell, Web-Scraping oder Partner-Zugang)
- **Daten:** 
  - 200.000+ Stellplätze weltweit
  - User-Bewertungen & Fotos
  - Kostenlos/Kostenpflichtig
  - GPS-Koordinaten
  - Ausstattung (Wasser, Strom, etc.)
  - Preise
- **Kategorien:**
  - Wohnmobilstellplatz
  - Parkplatz (Tag/Nacht)
  - Auf dem Bauernhof
  - Wohnmobilhändler
  - Privat
  - Campingplatz
- **Zugang:** 
  - Scraping (rechtlich fragwürdig)
  - Partnerschaft anfragen
  - Alternative: Eigene Datenbank aufbauen

### Option 2: **OSM (OpenStreetMap)**
- **API:** Overpass (bereits genutzt)
- **Tags:**
  - `tourism=caravan_site` (Wohnmobilstellplatz)
  - `tourism=camp_site` (Campingplatz)
  - `amenity=parking` + `caravan=yes`
  - `fee=yes/no`
- **Vorteil:** Kostenlos, Open Data
- **Nachteil:** Weniger Daten als Park4Night, keine Bewertungen

### Option 3: **Landvergnügen / Schau aufs Land**
- **Daten:** Bauernhof-Stellplätze (DE)
- **API:** Nein (nur App)
- **Vorteil:** Kostenlos, idyllisch
- **Nachteil:** Nur Deutschland

### Option 4: **ADAC Stellplatzführer**
- **Daten:** Kuratierte Stellplätze
- **API:** Nein
- **Zugang:** Nur für Mitglieder

### **Empfehlung:** 
1. **OSM (Overpass)** - Start mit Open Data
2. **Eigene User-DB** - User können Stellplätze hinzufügen/bewerten
3. **Park4Night** - Später, falls Partnerschaft möglich

## 🧮 Routing-Algorithmus

### Phase 1: Gesamtroute berechnen
```
Startpunkt → Ziel-Region → (optional) Rückreise
```
- OSRM/GraphHopper für Straßen-Routing
- Maut-Vermeidung
- Autobahn vs. Landstraße

### Phase 2: Tagesetappen segmentieren
```javascript
function segmentRoute(route, maxKmPerDay, avgSpeed) {
  let days = [];
  let currentDay = {
    distance: 0,
    duration: 0,
    segments: []
  };
  
  route.segments.forEach(segment => {
    // Prüfe ob Segment in aktuellen Tag passt
    if (currentDay.distance + segment.distance <= maxKmPerDay) {
      currentDay.segments.push(segment);
      currentDay.distance += segment.distance;
      currentDay.duration += segment.duration;
    } else {
      // Tag ist voll → Neuer Tag
      days.push(currentDay);
      currentDay = {
        distance: segment.distance,
        duration: segment.duration,
        segments: [segment]
      };
    }
  });
  
  days.push(currentDay);
  return days;
}
```

### Phase 3: Übernachtungen finden
```javascript
function findAccommodation(dayEndPoint, preferences) {
  // Suche Stellplätze in 20km Radius um Tagesendpunkt
  const stellplaetze = await searchStellplaetze(
    dayEndPoint.lat, 
    dayEndPoint.lon, 
    20 // km Radius
  );
  
  // Filter nach Präferenzen
  const filtered = stellplaetze.filter(s => {
    if (preferences.maxPrice && s.price > preferences.maxPrice) return false;
    if (preferences.freeOnly && s.price > 0) return false;
    if (preferences.needsElectricity && !s.electricity) return false;
    return true;
  });
  
  // Sortiere nach: Preis, Bewertung, Distanz
  return filtered.sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price; // Günstigster zuerst
    if (a.rating !== b.rating) return b.rating - a.rating; // Beste zuerst
    return a.distance - b.distance; // Näheste zuerst
  });
}
```

### Phase 4: Route optimieren
```javascript
// Passe Route an Stellplätze an
function optimizeRoute(days, stellplaetze) {
  return days.map((day, index) => {
    const accommodation = stellplaetze[index];
    
    // Leite Tagesendpunkt zum Stellplatz um
    const detour = calculateDetour(day.endPoint, accommodation);
    
    return {
      ...day,
      accommodation,
      detour,
      totalDistance: day.distance + detour.distance,
      totalDuration: day.duration + detour.duration
    };
  });
}
```

## 💾 Datenbank-Schema (Erweiterung)

### Neue Tabellen

#### `accommodations`
```sql
CREATE TABLE accommodations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50), -- stellplatz, campsite, wildcamping, farm
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  price DECIMAL(5, 2), -- 0 = kostenlos
  currency VARCHAR(3) DEFAULT 'EUR',
  rating DECIMAL(2, 1), -- 0-5
  capacity INTEGER, -- Anzahl Stellplätze
  features JSONB, -- {electricity: true, water: true, disposal: true, wifi: true}
  contact JSONB, -- {phone, email, website}
  opening_hours VARCHAR(255),
  notes TEXT,
  source VARCHAR(50), -- osm, user, park4night
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accommodations_location ON accommodations(lat, lon);
CREATE INDEX idx_accommodations_price ON accommodations(price);
CREATE INDEX idx_accommodations_type ON accommodations(type);
```

#### `accommodation_reviews`
```sql
CREATE TABLE accommodation_reviews (
  id SERIAL PRIMARY KEY,
  accommodation_id INTEGER REFERENCES accommodations(id),
  user_id INTEGER REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  visited_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `trip_plans`
```sql
CREATE TABLE trip_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  start_location JSONB, -- {lat, lon, address}
  end_location JSONB,
  start_date DATE,
  end_date DATE,
  max_km_per_day INTEGER,
  avg_speed INTEGER, -- km/h
  preferences JSONB, -- {avoidTolls, avoidHighways, maxPricePerNight, ...}
  route_data JSONB, -- Gesamtroute (GeoJSON)
  days JSONB, -- Array of daily plans
  total_distance DECIMAL(10, 2),
  total_duration DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `trip_day_plans`
```sql
CREATE TABLE trip_day_plans (
  id SERIAL PRIMARY KEY,
  trip_plan_id INTEGER REFERENCES trip_plans(id),
  day_number INTEGER,
  date DATE,
  start_location JSONB,
  end_location JSONB,
  accommodation_id INTEGER REFERENCES accommodations(id),
  distance DECIMAL(10, 2),
  duration DECIMAL(10, 2), -- Stunden
  route_data JSONB, -- GeoJSON
  highlights JSONB, -- POIs, Quests entlang der Route
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 UI/UX Flow

### 1. Trip-Planner-Seite (Neue Seite: `trip-planner.html`)

```
┌────────────────────────────────────────┐
│  🗺️ Multi-Day Trip Planner            │
├────────────────────────────────────────┤
│                                        │
│  📍 Start: [Heimatort eingeben____]   │
│  🎯 Ziel:  [Ziel-Region wählen▼___]   │
│                                        │
│  📅 Start-Datum: [16.10.2025_____]    │
│  📅 Rückreise:   [✓] Ja  [ ] Nein     │
│                                        │
│  🚗 Tages-Einstellungen:               │
│  ├─ Max. km/Tag: [350] km             │
│  ├─ Ø Geschwindigkeit: [70] km/h      │
│  └─ Max. Fahrtzeit: [6] Stunden       │
│                                        │
│  🏕️ Übernachtung:                      │
│  ├─ [ ] Nur kostenlos                 │
│  ├─ [✓] Bis 20€/Nacht                │
│  ├─ [✓] Ver-/Entsorgung               │
│  └─ [ ] Strom benötigt                │
│                                        │
│  🛣️ Route:                             │
│  ├─ [✓] Maut vermeiden                │
│  ├─ [ ] Autobahn vermeiden            │
│  └─ Offroad-Anteil: [20]%             │
│                                        │
│  [Route berechnen]                     │
└────────────────────────────────────────┘
```

### 2. Ergebnis-Anzeige

```
┌────────────────────────────────────────┐
│  📊 Routenplan: München → Pyrenäen     │
├────────────────────────────────────────┤
│  Gesamtdistanz: 1.250 km              │
│  Tage: 4 (3 Nächte)                   │
│  Kosten: 35 € (Übernachtungen)        │
│  Maut: 0 € (vermieden)                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  📅 Tag 1: München → Lyon              │
│  ├─ Distanz: 320 km                   │
│  ├─ Fahrzeit: 4h 30min                │
│  ├─ 🏕️ Übernachtung:                  │
│  │   Stellplatz Lyon-Gerland          │
│  │   📍 45.7320, 4.8367               │
│  │   💰 Kostenlos                     │
│  │   ⭐ 4.2/5 (128 Bewertungen)       │
│  │   ✓ Wasser ✓ Entsorgung           │
│  └─ [Details anzeigen]                │
├────────────────────────────────────────┤
│  📅 Tag 2: Lyon → Toulouse             │
│  ├─ Distanz: 360 km                   │
│  ├─ Fahrzeit: 5h 10min                │
│  ├─ 🏕️ Übernachtung:                  │
│  │   Camping Municipal Toulouse       │
│  │   💰 15 € / Nacht                  │
│  │   ⭐ 4.5/5 (87 Bewertungen)        │
│  └─ [Details anzeigen]                │
├────────────────────────────────────────┤
│  📅 Tag 3: Toulouse → Pyrenäen         │
│  ├─ Distanz: 280 km                   │
│  ├─ Fahrzeit: 4h 00min                │
│  ├─ 🏕️ Übernachtung:                  │
│  │   Stellplatz Argelès-Gazost        │
│  │   💰 10 € / Nacht                  │
│  │   ⭐ 4.8/5 (256 Bewertungen)       │
│  └─ [Details anzeigen]                │
├────────────────────────────────────────┤
│  [Route speichern] [Als GPX laden]    │
└────────────────────────────────────────┘
```

## 📡 API-Endpoints (Neu)

### POST `/api/trip-planner/calculate`
```json
{
  "startLocation": {
    "lat": 48.1351,
    "lon": 11.5820,
    "address": "München, Deutschland"
  },
  "endLocation": {
    "region": "pyrenees"
  },
  "startDate": "2025-10-20",
  "roundTrip": false,
  "preferences": {
    "maxKmPerDay": 350,
    "avgSpeed": 70,
    "maxDrivingHours": 6,
    "accommodation": {
      "maxPrice": 20,
      "freeOnly": false,
      "needsElectricity": false,
      "needsWater": true,
      "needsDisposal": true
    },
    "route": {
      "avoidTolls": true,
      "avoidHighways": false,
      "offroadPercent": 20
    }
  }
}
```

**Response:**
```json
{
  "tripPlan": {
    "id": 123,
    "totalDistance": 1250,
    "totalDuration": 18.5,
    "totalDays": 4,
    "totalCost": 35,
    "days": [
      {
        "dayNumber": 1,
        "date": "2025-10-20",
        "distance": 320,
        "duration": 4.5,
        "route": {...},
        "accommodation": {
          "id": 456,
          "name": "Stellplatz Lyon-Gerland",
          "type": "stellplatz",
          "price": 0,
          "rating": 4.2,
          "features": {...}
        }
      }
    ]
  }
}
```

### GET `/api/accommodations/search`
```
?lat=45.7320&lon=4.8367&radius=20&maxPrice=20&type=stellplatz
```

## 🚀 Implementierungs-Schritte

1. ✅ OSM Overpass Query für Wohnmobilstellplätze
2. Backend: Accommodation-Service
3. Backend: Trip-Planner-Service
4. Backend: Route-Segmentierung-Algorithmus
5. Frontend: Trip-Planner UI
6. Frontend: Tagesplan-Anzeige
7. GPX-Export mit Übernachtungen
8. User-Bewertungen für Stellplätze

## 📊 OSM Overpass Query (Stellplätze)

```javascript
const query = `
[out:json][timeout:25];
(
  // Wohnmobilstellplätze
  node["tourism"="caravan_site"](${south},${west},${north},${east});
  way["tourism"="caravan_site"](${south},${west},${north},${east});
  
  // Campingplätze
  node["tourism"="camp_site"](${south},${west},${north},${east});
  way["tourism"="camp_site"](${south},${west},${north},${east});
  
  // Parkplätze für Wohnmobile
  node["amenity"="parking"]["caravan"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["caravan"="yes"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`;
```

## 🎯 Beispiel-Szenario

**Input:**
- Start: München (48.1351, 11.5820)
- Ziel: Pyrenäen (Region)
- Max. 350 km/Tag
- Ø 70 km/h
- Max. 20€/Nacht
- Maut vermeiden

**Output:**
```
Tag 1: München → Lyon (320 km, 4.5h)
  → Stellplatz Lyon-Gerland (kostenlos)
  
Tag 2: Lyon → Toulouse (360 km, 5.1h)
  → Camping Toulouse (15€)
  
Tag 3: Toulouse → Pyrenäen (280 km, 4h)
  → Stellplatz Argelès-Gazost (10€)
  
Tag 4-7: Pyrenäen Offroad-Touren
  → Verschiedene Wildcamps & Stellplätze
  
Tag 8: Rückreise Start
  ...
```

---

Soll ich mit der **Implementierung** starten?
