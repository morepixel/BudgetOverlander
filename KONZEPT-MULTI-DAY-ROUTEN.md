# Konzept: Multi-Day Offroad-Routen

## 🎯 Ziel
"Ich will 7 Tage durch die Pyrenäen fahren - zeig mir zusammenhängende Offroad-Strecken ohne viel Hin-und-Her"

## 🧩 Herausforderungen

### 1. **Zusammenhängende Strecken finden**
- Einzelne Offroad-Wege müssen geografisch nah beieinander liegen
- Verbindungsstrecken zwischen Offroad-Abschnitten sollten kurz sein
- Route sollte nicht kreuz und quer springen

### 2. **Tages-Etappen planen**
- Realistische Tages-Distanzen (z.B. 100-200 km)
- Mix aus Offroad und Verbindungsstrecken
- Übernachtungspunkte (Campingplätze, Wildcamping-Spots)

### 3. **Budget berechnen**
- Spritkosten (Offroad verbraucht mehr)
- Maut (Autobahnen vermeiden)
- Übernachtung (Camping, Stellplätze)
- Verpflegung

## 💡 Lösungsansatz

### Phase 1: Daten sammeln (Overpass)
```
1. Definiere Gebiet (z.B. Pyrenäen: Bounding Box)
2. Hole ALLE Offroad-Tracks im Gebiet
3. Filtere nach Fahrzeug-Eignung
4. Speichere Koordinaten aller Wege
```

### Phase 2: Clustering (Geografische Nähe)
```
1. Gruppiere Wege nach geografischer Nähe
2. Finde "Hotspots" mit vielen Offroad-Strecken
3. Berechne Distanzen zwischen Hotspots
4. Erstelle "Zonen" (z.B. West-Pyrenäen, Zentral, Ost)
```

### Phase 3: Routen-Optimierung
```
1. Starte an einem Punkt (z.B. Pamplona)
2. Finde nächsten Hotspot mit vielen Offroad-Strecken
3. Berechne Tages-Etappe (Offroad + Verbindung)
4. Wiederhole für X Tage
5. Optimiere für minimale Verbindungsstrecken
```

### Phase 4: Detaillierte Planung
```
1. Für jede Tages-Etappe:
   - Liste aller Offroad-Abschnitte
   - Verbindungsstrecken (asphaltiert)
   - Gesamt-Distanz & Fahrzeit
   - Budget (Sprit, Maut, Übernachtung)
   - POIs (Tankstellen, Supermärkte, Campingplätze)
```

## 🛠️ Technische Umsetzung

### MVP (Minimum Viable Product)

#### 1. Daten-Sammlung
```javascript
// Hole alle Offroad-Tracks in Pyrenäen
const bbox = {
  south: 42.0,  // Südgrenze
  north: 43.5,  // Nordgrenze
  west: -2.0,   // Westgrenze
  east: 3.0     // Ostgrenze
};

// Overpass-Query für gesamtes Gebiet
const tracks = await getOffroadTracks(bbox);
// → ~500-1000 Tracks
```

#### 2. Geografisches Clustering
```javascript
// Gruppiere Tracks nach 20km-Radius
const clusters = clusterByDistance(tracks, 20000); // 20km
// → ~10-20 Cluster/Hotspots

// Beispiel Cluster:
{
  id: "cluster_1",
  center: { lat: 42.5, lon: 0.5 },
  tracks: [track1, track2, ...],
  totalLength: 45.3, // km Offroad
  avgDifficulty: 55,
}
```

#### 3. Multi-Day Route
```javascript
const route = planMultiDayRoute({
  startPoint: { lat: 42.8, lon: -1.6 }, // Pamplona
  days: 7,
  maxDailyDistance: 150, // km
  minOffroadPercentage: 60, // 60% Offroad
});

// Ergebnis:
{
  days: [
    {
      day: 1,
      start: "Pamplona",
      end: "Cluster_1",
      offroad: 35.2, // km
      onroad: 45.8,  // km
      duration: 4.5, // Stunden
      fuel: 12.5,    // Liter
      cost: 20.50,   // Euro
    },
    // ... Tag 2-7
  ]
}
```

### Vollversion (mit Routing-Engine)

#### Integration: OSRM / GraphHopper
```javascript
// Berechne tatsächliche Route zwischen Punkten
const route = await routingEngine.calculate({
  waypoints: [start, cluster1, cluster2, ..., end],
  profile: "car", // oder "truck"
  avoidHighways: true,
  avoidTolls: true,
});

// Ergebnis: Turn-by-turn Navigation
```

#### Höhenprofil (SRTM)
```javascript
// Hole Höhendaten für Route
const elevation = await getElevationProfile(route);
// → Steigungen, Pässe, Höhenmeter
```

#### POI-Integration
```javascript
// Finde Campingplätze entlang Route
const camping = await findPOIs({
  type: "camping",
  alongRoute: route,
  maxDetour: 5, // km
});
```

## 📊 Beispiel-Output

### 7-Tage Pyrenäen-Route

**Tag 1: Pamplona → Valle de Roncal**
- Start: Pamplona (42.8167, -1.6432)
- Offroad: 32 km (3 Tracks)
- Verbindung: 48 km (asphaltiert)
- Gesamt: 80 km, ~4h
- Schwierigkeit: Mittel (Score: 45/100)
- Übernachtung: Camping Roncal
- Budget: 18€ Sprit + 15€ Camping = 33€

**Tag 2: Valle de Roncal → Parque Natural Ordesa**
- Offroad: 45 km (5 Tracks)
- Verbindung: 35 km
- Gesamt: 80 km, ~5h
- Schwierigkeit: Mittel-Schwer (Score: 60/100)
- Highlights: Pista del Barranco, Camino Forestal
- Budget: 22€ Sprit + 15€ Camping = 37€

**Tag 3-7: ...**

**Gesamt:**
- 7 Tage, ~600 km
- Offroad: 380 km (63%)
- Asphalt: 220 km (37%)
- Budget: ~250€ (Sprit + Camping)
- Schwierigkeit: Mix (40-70/100)

## 🚀 Implementierungs-Schritte

### Schritt 1: Daten-Sammlung (heute machbar)
```bash
node collect-region-data.js pyrenees
# → Sammelt alle Tracks in Pyrenäen
# → Speichert als JSON
```

### Schritt 2: Einfaches Clustering (heute machbar)
```bash
node cluster-tracks.js pyrenees-data.json
# → Gruppiert nach geografischer Nähe
# → Zeigt Hotspots
```

### Schritt 3: Manuelle Routen-Planung (heute machbar)
```
1. Schaue Cluster-Karte an
2. Wähle manuell Cluster für jeden Tag
3. Berechne Distanzen & Budget
```

### Schritt 4: Automatische Routen-Optimierung (später)
```bash
node plan-multi-day-route.js \
  --region pyrenees \
  --days 7 \
  --start "Pamplona" \
  --offroad-min 60
# → Automatische Route mit Optimierung
```

### Schritt 5: Integration Routing-Engine (später)
```
- OSRM für Turn-by-turn
- SRTM für Höhenprofile
- Overpass für POIs
```

## 🎯 Was können wir JETZT bauen?

### Prototyp: Pyrenäen-Daten-Sammlung
1. **Script erstellen:** Sammelt alle Tracks in Pyrenäen
2. **Clustering:** Gruppiert nach geografischer Nähe
3. **Visualisierung:** Zeigt Hotspots auf Karte (GeoJSON)
4. **Manuelle Planung:** User wählt Cluster für jeden Tag

### Output:
```json
{
  "region": "Pyrenäen",
  "clusters": [
    {
      "id": "west_pyrenees_1",
      "center": [42.8, -0.5],
      "tracks": 15,
      "totalKm": 67.3,
      "avgDifficulty": 52,
      "nearestTown": "Jaca"
    },
    // ... mehr Cluster
  ]
}
```

## 💭 Limitierungen (ohne Routing-Engine)

**Was fehlt ohne OSRM/GraphHopper:**
- ❌ Keine exakte Route zwischen Punkten
- ❌ Keine Turn-by-turn Navigation
- ❌ Keine Fahrzeit-Berechnung für Verbindungsstrecken
- ❌ Keine Vermeidung von Autobahnen/Maut

**Workaround:**
- ✅ Zeige Cluster-Zentren auf Karte
- ✅ User plant grobe Route manuell
- ✅ Exportiere Waypoints als GPX
- ✅ User nutzt eigenes Navi für Verbindungsstrecken

## 🎊 Fazit

**Für MVP:**
Wir können ein Tool bauen, das Offroad-Hotspots findet und dem User hilft, eine grobe Route zu planen.

**Für Production:**
Integration einer Routing-Engine ist notwendig für vollautomatische Multi-Day-Planung.

**Nächster Schritt:**
Soll ich einen Prototyp bauen, der Pyrenäen-Daten sammelt und Hotspots zeigt?
