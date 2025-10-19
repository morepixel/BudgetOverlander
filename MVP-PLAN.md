# Budget Overlander - MVP Plan

## 🎯 MVP Ziel
Eine Web-App, mit der User Multi-Day Offroad-Routen in verschiedenen Regionen planen können.

## 👤 User Story
"Als Overlander möchte ich eine 7-Tage-Route durch die Pyrenäen planen, die mir zeigt:
- Wo die besten Offroad-Hotspots sind
- Wie ich sie verbinde (echte Straßen)
- Was es kostet (Sprit, Camping, Essen)
- Wie schwierig die Strecken sind"

## ✅ MVP Features (Must-Have)

### 1. Region auswählen
- Dropdown: Pyrenäen, Sierra Nevada, Südalpen, Norwegen
- Zeigt Karte mit allen Offroad-Clustern
- Cluster-Infos: Anzahl Tracks, km Offroad, Schwierigkeit

### 2. Cluster auswählen
- User klickt Cluster auf Karte an
- Ausgewählte Cluster werden markiert
- Reihenfolge per Drag & Drop änderbar

### 3. Route berechnen
- Button "Route berechnen"
- Zeigt echte Straßenrouten (OSRM)
- Tages-Etappen mit Budget
- Gesamt-Statistik

### 4. Route visualisieren
- Interaktive Karte (MapLibre/Leaflet)
- Marker für jeden Tag (nummeriert)
- Routen-Linien zwischen Clustern
- Popup mit Details (Offroad-km, Budget, Schwierigkeit)

### 5. Route exportieren
- GPX-Download für Navi
- PDF-Zusammenfassung
- JSON für später

## 🚫 MVP Nicht-Features (Nice-to-Have für später)

- ❌ User-Accounts / Login
- ❌ Routen speichern in DB
- ❌ Community-Bewertungen
- ❌ Höhenprofile
- ❌ POI-Integration (Camping, Tankstellen)
- ❌ Offline-Modus
- ❌ Mobile App (nur Web)
- ❌ Eigene Overpass-Daten sammeln (nutze vorberechnete)

## 🛠️ Technologie-Stack

### Backend (Node.js)
```
- Express.js (API Server)
- Vorberechnete Region-Daten (JSON)
- OSRM API für Routing
- Keine Datenbank (File-based)
```

### Frontend (Einfach & Schnell)
```
- Vanilla HTML/CSS/JavaScript (kein Framework!)
- MapLibre GL JS (Karten)
- Fetch API für Backend-Calls
```

### Deployment
```
- Backend: Vercel / Railway / Render (kostenlos)
- Frontend: Netlify / Vercel (kostenlos)
- Oder: Alles zusammen auf einem Server
```

## 📁 Projekt-Struktur

```
budget-overlander/
├── backend/
│   ├── server.js              # Express API
│   ├── routes/
│   │   ├── regions.js         # GET /api/regions
│   │   ├── clusters.js        # GET /api/regions/:id/clusters
│   │   └── routes.js          # POST /api/routes/calculate
│   ├── data/
│   │   ├── pyrenees.json      # Vorberechnete Cluster
│   │   ├── sierra-nevada.json
│   │   └── ...
│   └── package.json
│
├── frontend/
│   ├── index.html             # Landing Page
│   ├── app.html               # Haupt-App
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── map.js             # Karten-Logik
│   │   ├── route-planner.js   # Routen-Planung
│   │   └── api.js             # Backend-Calls
│   └── assets/
│       └── logo.png
│
└── scripts/                   # Bestehende Scripts
    ├── collect-region-tracks.js
    └── plan-multi-day-route-with-routing.js
```

## 🚀 MVP Entwicklungs-Schritte

### Phase 1: Backend API (2-3h)
1. Express.js Server aufsetzen
2. API-Endpoints erstellen:
   - `GET /api/regions` → Liste aller Regionen
   - `GET /api/regions/:id/clusters` → Cluster einer Region
   - `POST /api/routes/calculate` → Route berechnen
3. Vorberechnete Daten einbinden
4. OSRM-Integration testen

### Phase 2: Frontend Basis (3-4h)
1. Landing Page (Region auswählen)
2. Karte mit MapLibre GL JS
3. Cluster als Marker anzeigen
4. Cluster-Auswahl (Click)
5. Ausgewählte Cluster-Liste

### Phase 3: Routen-Planung (2-3h)
1. "Route berechnen" Button
2. Backend-Call mit ausgewählten Clustern
3. Route auf Karte zeichnen
4. Tages-Etappen anzeigen
5. Budget-Übersicht

### Phase 4: Export & Polish (1-2h)
1. GPX-Export
2. PDF-Export (oder einfach Print-CSS)
3. Responsive Design
4. Error-Handling
5. Loading-States

**Gesamt: ~10h Entwicklungszeit**

## 📊 MVP User Flow

```
1. Landing Page
   ↓
2. Region auswählen (z.B. Pyrenäen)
   ↓
3. Karte mit 108 Clustern wird geladen
   ↓
4. User klickt Cluster an (z.B. 7 Stück für 7 Tage)
   ↓
5. User klickt "Route berechnen"
   ↓
6. Backend berechnet Route mit OSRM
   ↓
7. Route wird auf Karte gezeichnet
   ↓
8. Tages-Etappen & Budget werden angezeigt
   ↓
9. User exportiert als GPX/PDF
```

## 🎨 UI Mockup (Textbasiert)

```
┌─────────────────────────────────────────────────────────────┐
│ 🚙 Budget Overlander                          [Über] [Hilfe] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Region: [Pyrenäen ▼]                    [Route berechnen]   │
│                                                               │
│  ┌────────────────────────┐  ┌──────────────────────────┐   │
│  │                        │  │ Ausgewählte Cluster:     │   │
│  │                        │  │                          │   │
│  │      KARTE             │  │ 1. cluster_28 (356 km)   │   │
│  │   (mit Clustern)       │  │ 2. cluster_32 (333 km)   │   │
│  │                        │  │ 3. cluster_36 (235 km)   │   │
│  │                        │  │ 4. cluster_11 (198 km)   │   │
│  │                        │  │                          │   │
│  │                        │  │ [Löschen] [Neu ordnen]   │   │
│  └────────────────────────┘  └──────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📊 Route: 4 Tage, 690 km (46% Offroad)              │   │
│  │ 💰 Budget: 328€ (Sprit: 168€, Camping: 60€, ...)    │   │
│  │ ⏱️  Fahrzeit: 18h (Ø 4.5h/Tag)                       │   │
│  │                                                       │   │
│  │ [GPX Download] [PDF Export] [Teilen]                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 💰 Kosten-Schätzung

### Entwicklung
- **10h Entwicklung** (bei dir selbst: 0€)
- Oder Freelancer: ~500-1000€

### Hosting (Monatlich)
- **Backend:** Vercel/Railway Free Tier → 0€
- **Frontend:** Netlify Free Tier → 0€
- **OSRM API:** Öffentlich → 0€ (mit Rate-Limits)
- **Domain:** ~1€/Monat

**MVP Total: 0-1€/Monat** 🎉

### Später (Production)
- Eigener OSRM Server: ~20€/Monat
- Datenbank (PostgreSQL): ~10€/Monat
- CDN für Karten: ~5€/Monat
- **Total: ~35€/Monat**

## 🎯 Success Metrics für MVP

- ✅ User kann Region auswählen
- ✅ User kann Cluster sehen und auswählen
- ✅ Route wird mit echten Straßen berechnet
- ✅ Budget wird angezeigt
- ✅ GPX-Export funktioniert
- ✅ App läuft auf Desktop & Mobile

## 🚀 Go-Live Strategie

1. **Soft Launch:** Teile mit Freunden/Familie
2. **Feedback sammeln:** Was fehlt? Was nervt?
3. **Iteration:** 2-3 Verbesserungs-Runden
4. **Public Launch:** Reddit (r/overlanding), Facebook-Gruppen
5. **Marketing:** YouTube-Video, Blog-Posts

## 📈 Roadmap nach MVP

### Version 1.1 (1 Monat)
- User-Accounts
- Routen speichern
- Höhenprofile

### Version 1.2 (2 Monate)
- POI-Integration (Camping, Tankstellen)
- Community-Bewertungen
- Fotos hochladen

### Version 2.0 (3-6 Monate)
- Mobile App (React Native)
- Offline-Modus
- Eigener OSRM Server
- Premium-Features (detaillierte Tracks, etc.)

## 🎊 Fazit

**MVP ist in ~10h machbar!**

Die Grundlage (Daten-Sammlung, Clustering, Routing) ist bereits fertig.
Jetzt nur noch eine einfache Web-UI drumherum bauen.

**Nächster Schritt:** Backend API aufsetzen?
