# Budget Overlander - Overpass API Test

Test-Script zur Evaluierung der Overpass-API für Offroad-Routen-Daten.

## Was macht das Script?

Das Script fragt die Overpass-API (OpenStreetMap) ab und holt Offroad-taugliche Wege im Umkreis von Freiburg im Breisgau.

### Gefiltert wird nach:
- **Highway-Typen**: track, unclassified, service, path (mit motor_vehicle erlaubt)
- **Oberflächen**: gravel, dirt, ground, unpaved, fine_gravel, rock, sand
- **Zugang**: Keine privaten oder gesperrten Wege

### Das Script liefert:
- Anzahl gefundener Wege
- Gesamtlänge aller Wege
- Statistiken zu Highway-Typen, Oberflächen, Tracktypes, Smoothness
- Beispiel-Wege mit allen Details
- Rohdaten als JSON
- Statistiken als JSON

## Installation

Keine Dependencies nötig! Node.js 18+ reicht.

## Verwendung

### Basis-Verwendung:
```bash
node test-overpass-api.js [query-size] [minLänge] [minFahrzeit]
```

**Parameter:**
- `query-size`: mini (3km), small (10km), medium (25km), large (50km)
- `minLänge`: Mindestlänge in Metern (Standard: 500m)
- `minFahrzeit`: Mindest-Fahrzeit in Minuten (Standard: 5 Min)

### Beispiele:

#### Schneller Test (Standard-Filter: 500m, 5 Min):
```bash
node test-overpass-api.js mini
```

#### Realistische Touren (>2km, >10 Min):
```bash
node test-overpass-api.js small 2000 10
```

#### Längere Touren (>5km, >30 Min):
```bash
node test-overpass-api.js medium 5000 30
```

#### Sehr lange Touren (>10km, >60 Min):
```bash
node test-overpass-api.js large 10000 60
```

## Ausgabe

Das Script erstellt:
- `overpass-raw-{size}-{timestamp}.json` - Komplette API-Antwort
- `overpass-stats-{size}-{timestamp}.json` - Berechnete Statistiken

## Nächste Schritte

Basierend auf den Test-Ergebnissen können wir:
1. Scoring-System entwickeln (surface, tracktype, smoothness)
2. Routen-Visualisierung auf Karte
3. Budget-Kalkulation (Distanz, Spritverbrauch)
4. GPX-Export für Navigation
5. Filter nach Fahrzeug-Constraints (Gewicht, Breite, Höhe)
