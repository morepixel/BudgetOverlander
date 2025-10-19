# Overpass-API Datenstruktur - Analyse

## ✅ Test erfolgreich!

Die Overpass-API liefert **exzellente Daten** für deine Budget-Overlander-App!

## 📊 Test-Ergebnisse (3km Radius um Freiburg)

- **67 Offroad-Wege** gefunden
- **13.52 km** Gesamtlänge
- **Durchschnittlich 202m** pro Weg
- **14.9%** haben Namen
- **100%** haben GPS-Koordinaten und Oberflächeninfo

## 🗂️ Datenstruktur eines Weges

```json
{
  "type": "way",
  "id": 4866475,
  "bounds": {
    "minlat": 48.0244824,
    "minlon": 7.8349634,
    "maxlat": 48.0245973,
    "maxlon": 7.8350023
  },
  "geometry": [
    { "lat": 48.0245973, "lon": 7.8349634 },
    { "lat": 48.0245589, "lon": 7.8349848 },
    { "lat": 48.0244824, "lon": 7.8350023 }
  ],
  "tags": {
    "highway": "track",
    "surface": "gravel",
    "tracktype": "grade3",
    "smoothness": "intermediate",
    "sac_scale": "hiking",
    "access": "yes",
    "motor_vehicle": "no",
    "name": "Forstweg Hinterzarten"
  }
}
```

## 🏷️ Wichtige Tags für Scoring

### 1. **highway** (Straßentyp)
- `track` - Feldweg/Forstweg (100% in unserem Test)
- `unclassified` - Unbefestigte Nebenstraße
- `service` - Zufahrtsweg
- `path` - Pfad (nur wenn motor_vehicle erlaubt)

### 2. **surface** (Oberfläche)
Verteilung im Test:
- `ground` - 52.2% (Naturboden)
- `gravel` - 34.3% (Schotter)
- `dirt` - 13.4% (Erde/Dreck)

Weitere mögliche Werte:
- `unpaved`, `fine_gravel`, `rock`, `sand`

### 3. **tracktype** (Befestigungsgrad)
Verteilung im Test:
- `grade3` - 30% (deutliche Spuren, meist befahrbar)
- `grade2` - 28% (überwiegend befestigt)
- `grade4` - 21% (meist unbefestigt, schwierig)
- `grade5` - 12% (keine Befestigung, sehr schwierig)
- `grade1` - 1% (asphaltiert/betoniert)

**Wichtig für Scoring:** grade1-2 = leicht, grade3 = mittel, grade4-5 = schwer

### 4. **smoothness** (Fahrkomfort)
Verteilung im Test (nur 14 von 67 haben dieses Tag):
- `intermediate` - 43%
- `very_horrible` - 29%
- `bad` - 21%
- `very_bad` - 7%

Skala: `excellent` > `good` > `intermediate` > `bad` > `very_bad` > `horrible` > `very_horrible` > `impassable`

### 5. **access** / **motor_vehicle**
- `yes` / `designated` - Erlaubt
- `permissive` - Geduldet
- `no` / `private` - Verboten (wird ausgefiltert)

### 6. Weitere nützliche Tags
- `name` - Name des Weges (14.9% haben Namen)
- `maxweight` - Max. Gewicht in Tonnen
- `maxwidth` - Max. Breite in Metern
- `maxheight` - Max. Höhe in Metern
- `ford` - Wasserdurchfahrt (yes/no)
- `incline` - Steigung in % oder Grad
- `sac_scale` - Schwierigkeitsgrad für Wanderwege

## 🎯 Scoring-Vorschlag für MVP

### Schwierigkeits-Score (0-100 Punkte)

```javascript
function calculateDifficultyScore(tags) {
  let score = 0;
  
  // Surface (0-40 Punkte)
  const surfaceScores = {
    'paved': 0, 'asphalt': 0, 'concrete': 0,
    'fine_gravel': 10, 'gravel': 15,
    'ground': 25, 'dirt': 30,
    'sand': 35, 'rock': 40
  };
  score += surfaceScores[tags.surface] || 20;
  
  // Tracktype (0-30 Punkte)
  const tracktypeScores = {
    'grade1': 0, 'grade2': 10, 'grade3': 20,
    'grade4': 25, 'grade5': 30
  };
  score += tracktypeScores[tags.tracktype] || 15;
  
  // Smoothness (0-30 Punkte)
  const smoothnessScores = {
    'excellent': 0, 'good': 5, 'intermediate': 10,
    'bad': 15, 'very_bad': 20, 'horrible': 25,
    'very_horrible': 30, 'impassable': 30
  };
  score += smoothnessScores[tags.smoothness] || 10;
  
  return Math.min(score, 100);
}
```

### Kategorien
- **0-30 Punkte**: 🟢 Leicht (Anfänger)
- **31-60 Punkte**: 🟡 Mittel (Erfahren)
- **61-100 Punkte**: 🔴 Schwer (Profi)

## 💰 Budget-Berechnung

### Distanz
Bereits berechnet via Haversine-Formel:
```javascript
const lengthKm = wayLengthMeters(geometry) / 1000;
```

### Spritverbrauch-Faktor
Offroad verbraucht mehr:
- **Leichte Strecke**: +20% Verbrauch
- **Mittlere Strecke**: +40% Verbrauch
- **Schwere Strecke**: +60% Verbrauch

```javascript
const baseConsumption = 12; // L/100km
const offroadFactor = difficulty <= 30 ? 1.2 : difficulty <= 60 ? 1.4 : 1.6;
const offroadConsumption = baseConsumption * offroadFactor;
const fuelCost = (lengthKm / 100) * offroadConsumption * fuelPricePerLiter;
```

### Zeitberechnung
Offroad ist langsamer:
- **Leichte Strecke**: 40 km/h
- **Mittlere Strecke**: 25 km/h
- **Schwere Strecke**: 15 km/h

## 🗺️ Nächste Schritte für die App

### 1. Backend-Integration
- Overpass-Query als API-Endpoint
- Caching der Ergebnisse (OSM-Daten ändern sich nicht oft)
- Vorberechnung von Scores

### 2. Frontend-Visualisierung
- MapLibre GL JS oder Leaflet für Kartendarstellung
- Farbcodierung nach Schwierigkeit (grün/gelb/rot)
- Popup mit Details (Länge, Score, Surface, etc.)

### 3. Routen-Planung
- Mehrere Wege zu einer Route verbinden
- Gesamt-Score und Budget berechnen
- GPX-Export für Navigation

### 4. Filter-Optionen
- Nach Schwierigkeit filtern
- Nach Fahrzeug-Constraints (Gewicht, Breite, Höhe)
- Nach Distanz/Budget filtern
- Wasserdurchfahrten ein/ausblenden

### 5. Erweiterte Features
- Höhenprofil via SRTM-Daten
- Wetter-Integration
- Community-Bewertungen
- Offline-Karten

## 📝 Fazit

**Die Overpass-API ist perfekt geeignet!** ✅

- ✅ Detaillierte Daten vorhanden
- ✅ Echtzeit-Zugriff möglich
- ✅ Kostenlos und Open Source
- ✅ Weltweit verfügbar
- ✅ Alle nötigen Attribute für Scoring
- ✅ GPS-Koordinaten für Kartendarstellung

**Einzige Einschränkung:** Öffentliche Server können bei großen Queries überlastet sein.
**Lösung:** Eigener Overpass-Server oder Caching der Ergebnisse.
