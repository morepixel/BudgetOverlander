# Budget Overlander - Projekt Status

**Stand:** 8. Februar 2026  
**Version:** MVP Phase  
**Deployment:** In Vorbereitung

---

## 📊 Übersicht

Budget Overlander ist eine Web-App zur Planung von Multi-Day Offroad-Routen für Overlander mit Expeditionsfahrzeugen. Die App kombiniert Budget-Kalkulation mit intelligenter Routen-Optimierung basierend auf OpenStreetMap-Daten.

---

## ✅ Fertiggestellte Komponenten

### Backend API (100%)

**Technologie:** Node.js + Express.js  
**Port:** 3000  
**Status:** Voll funktionsfähig

#### Implementierte Endpoints:

| Endpoint | Route | Status | Beschreibung |
|----------|-------|--------|--------------|
| **Auth** | `/api/auth` | ✅ | Login, Register, JWT-Token |
| **Regions** | `/api/regions` | ✅ | Offroad-Regionen laden |
| **Routes** | `/api/routes` | ✅ | Routen-Berechnung mit OSRM |
| **Vehicles** | `/api/vehicles` | ✅ | Fahrzeug-Profile verwalten |
| **POIs** | `/api/pois` | ✅ | Points of Interest |
| **Quests** | `/api/quests` | ✅ | Gamification-System |
| **Badges** | `/api/badges` | ✅ | Achievement-System |
| **Profile** | `/api/profile` | ✅ | User-Profile |
| **Accommodations** | `/api/accommodations` | ✅ | Unterkünfte/Camping |
| **Trip Planner** | `/api/trip-planner` | ✅ | Multi-Day Routen |
| **Geocoding** | `/api/geocoding` | ✅ | Adress-Suche |
| **AI Routes** | `/api/ai` | ✅ | KI-gestützte Planung |
| **Park4Night** | `/api/park4night` | ✅ | Stellplatz-Integration |
| **Photos** | `/api/photos` | ✅ | Foto-Upload |

**Dependencies:**
- express
- cors
- dotenv
- bcryptjs
- jsonwebtoken
- node-fetch
- openai (für KI-Features)

---

### Frontend (80%)

**Technologie:** Vanilla HTML/CSS/JavaScript + Leaflet Maps  
**Status:** Hauptfeatures fertig, Feinschliff nötig

#### Seiten:

| Seite | Datei | Status | Beschreibung |
|-------|-------|--------|--------------|
| **Landing Page** | `index.html` | ✅ | Startseite mit Region-Auswahl |
| **Trip Planner** | `trip-planner.html` | ✅ | Hauptfeature - Route planen |
| **Mobile Version** | `trip-planner-mobile.html` | ✅ | Optimiert für Smartphones |
| **Budget Radar** | `budget-radar.html` | ✅ | Budget-basierte Suche |
| **Profile** | `profile.html` | ✅ | User-Profil & Statistiken |
| **Vehicles** | `vehicles.html` | ✅ | Fahrzeug-Verwaltung |

**Features:**
- ✅ Interaktive Leaflet-Karten
- ✅ Cluster-Auswahl per Click
- ✅ Drag & Drop für Reihenfolge
- ✅ Budget-Kalkulation in Echtzeit
- ✅ Responsive Design (Desktop + Mobile)
- ✅ PWA-Support (Progressive Web App)
- ✅ Service Worker für Offline-Basis

---

### Daten & Algorithmen (90%)

#### Overpass-API Integration ✅
- Offroad-Wege aus OpenStreetMap
- Filter: track, unclassified, service, path
- Oberflächen: gravel, dirt, ground, unpaved, rock, sand
- Zugangs-Filter: Keine privaten/gesperrten Wege

#### Scoring-System ✅
Automatische Schwierigkeits-Bewertung basierend auf:
- **Surface** (Oberfläche): gravel=10, dirt=20, rock=30, sand=40
- **Tracktype** (Befestigung): grade1=5, grade2=10, grade3=15, grade4=20, grade5=25
- **Smoothness** (Komfort): excellent=0, good=5, intermediate=15, bad=25, very_bad=35

**Kategorien:**
- 🟢 Leicht: 0-30 Punkte
- 🟡 Mittel: 31-60 Punkte
- 🔴 Schwer: 61-100 Punkte

#### Clustering-Algorithmus ✅
- Gruppiert Offroad-Tracks zu Hotspots
- Berechnet Cluster-Zentren
- Statistiken pro Cluster (km, Tracks, Schwierigkeit)

#### OSRM-Routing ✅
- Echte Straßenverbindungen zwischen Clustern
- Distanz- und Zeitberechnung
- Tagesetappen-Planung

#### Vorberechnete Regionen ✅
- **Pyrenäen**: 108 Cluster, 3084 km Offroad
- **Sierra Nevada**: 42 Cluster, 274 km Offroad
- Weitere Regionen vorbereitet (Norwegen, Südalpen)

---

## 🔧 In Arbeit / Unvollständig

### Kritische Punkte

#### 1. Datenbank (⚠️ File-based)
**Status:** Aktuell `database.json` - nicht production-ready  
**Benötigt:**
- Migration zu PostgreSQL
- User-Daten persistent speichern
- Routen-Historie
- Backup-Strategie

**Dateien:**
- `backend/database.js` - DB-Abstraction Layer
- `backend/database.json` - Temporärer File-Store

#### 2. Authentifizierung (⚠️ Basic)
**Status:** JWT funktioniert, aber unvollständig  
**Vorhanden:**
- ✅ Login/Register
- ✅ JWT-Token-Generierung
- ✅ Password-Hashing (bcrypt)

**Fehlt:**
- ❌ Passwort-Reset
- ❌ Email-Verifizierung
- ❌ Session-Management
- ❌ OAuth (Google/Facebook)

#### 3. Deployment (❌ Nicht konfiguriert)
**Geplant:**
- Backend: Hetzner/Railway
- Frontend: Netlify
- Domain: TBD

**Dateien vorhanden:**
- `DEPLOYMENT.md` - Deployment-Anleitung
- `HETZNER-FIX.md` - Hetzner-spezifische Fixes
- `RAILWAY-DEPLOYMENT.md` - Railway-Anleitung
- `setup-hetzner.sh` - Setup-Script
- `netlify.toml` - Netlify-Config

---

## ❌ Fehlende Features (Nice-to-Have)

### Für v1.0

1. **Höhenprofile** ❌
   - SRTM/ASTER-Daten Integration
   - Steigungs-Berechnung
   - Pässe-Erkennung

2. **GPX-Export** ⚠️
   - Basis vorhanden, nicht vollständig getestet
   - Waypoints für Cluster
   - Track-Segmente

3. **PDF-Export** ❌
   - Routen-Zusammenfassung
   - Tages-Etappen
   - Budget-Breakdown

4. **Offline-Modus** ⚠️
   - Service Worker vorhanden (`sw.js`)
   - Vektortiles fehlen
   - Offline-Routing fehlt

### Für v2.0

5. **Community-Features** ❌
   - User-Bewertungen
   - Foto-Uploads (API vorhanden, UI fehlt)
   - "Bin ich gefahren"-Funktion
   - Kommentare

6. **Erweiterte POIs** ❌
   - Wasser-Stellen (`amenity=drinking_water`)
   - Entsorgung (`amenity=waste_disposal`)
   - iOverlander-Integration (API vorhanden)

7. **Fahrzeug-Profile** ⚠️
   - Default FUSO vorhanden
   - User-spezifische Profile fehlen
   - 4x4-Flag fehlt
   - Bodenfreiheit-Berücksichtigung fehlt

8. **Budget-Radar** ⚠️
   - UI vorhanden (`budget-radar.html`)
   - Backend-Logik unvollständig
   - "Zeige mir alle Routen für 300€ in 200km Umkreis"

---

## 📁 Projekt-Struktur

```
Budget Overlander/
├── backend/
│   ├── server.js                 # Express API Server
│   ├── database.js               # DB Abstraction Layer
│   ├── database.json             # Temporärer File-Store
│   ├── routes/                   # 14 API-Endpoints
│   │   ├── auth.js
│   │   ├── regions.js
│   │   ├── routes.js
│   │   ├── vehicles.js
│   │   ├── pois.js
│   │   ├── quests.js
│   │   ├── badges.js
│   │   ├── profile.js
│   │   ├── accommodations.js
│   │   ├── trip-planner.js
│   │   ├── geocoding.js
│   │   ├── ai-routes.js
│   │   ├── park4night.js
│   │   └── photos.js
│   ├── utils/                    # Helper-Funktionen
│   └── scripts/                  # Daten-Sammlung
│
├── frontend/
│   ├── index.html                # Landing Page
│   ├── trip-planner.html         # Haupt-App
│   ├── trip-planner-mobile.html  # Mobile Version
│   ├── budget-radar.html         # Budget-Suche
│   ├── profile.html              # User-Profil
│   ├── vehicles.html             # Fahrzeuge
│   ├── css/
│   │   ├── style.css
│   │   └── mobile-styles.css
│   ├── js/
│   │   ├── map.js
│   │   └── api.js
│   ├── manifest.json             # PWA Manifest
│   └── sw.js                     # Service Worker
│
├── scripts/                      # Standalone Scripts
│   ├── test-overpass-api.js      # Overpass-API Tester
│   ├── collect-region-tracks.js  # Region-Daten sammeln
│   ├── plan-multi-day-route.js   # Routen-Planer
│   └── beispiel-scoring.js       # Scoring-Demo
│
├── DATENSTRUKTUR.md              # Daten-Dokumentation
├── MVP-PLAN.md                   # MVP Entwicklungsplan
├── KONZEPT-MULTI-DAY-ROUTEN.md   # Routen-Konzept
├── KI-INTEGRATION-KONZEPT.md     # KI-Features
├── DEPLOYMENT.md                 # Deployment-Guide
├── HETZNER-FIX.md                # Hetzner-Fixes
├── RAILWAY-DEPLOYMENT.md         # Railway-Guide
├── ZUSAMMENFASSUNG.md            # Projekt-Zusammenfassung
└── README.md                     # Projekt-Übersicht
```

---

## 🚀 Nächste Schritte (Priorität)

### Phase 1: Testing & Integration (1-2 Tage)
- [ ] Frontend mit Backend verbinden
- [ ] Alle API-Endpoints testen
- [ ] Mobile-Ansicht optimieren
- [ ] Cross-Browser-Testing
- [ ] Error-Handling verbessern

### Phase 2: Deployment-Vorbereitung (1 Tag)
- [ ] Environment-Variablen konfigurieren
- [ ] Production-Build erstellen
- [ ] Hetzner-Server aufsetzen
- [ ] Netlify-Deployment konfigurieren
- [ ] Domain aufschalten

### Phase 3: Datenbank-Migration (1-2 Tage)
- [ ] PostgreSQL aufsetzen
- [ ] Schema erstellen
- [ ] Migration von `database.json`
- [ ] Backup-Strategie implementieren
- [ ] Connection-Pooling

### Phase 4: MVP Launch (1 Tag)
- [ ] Monitoring einrichten (Uptime, Errors)
- [ ] Analytics integrieren
- [ ] Beta-User einladen (5-10 Personen)
- [ ] Feedback sammeln
- [ ] Kritische Bugs fixen

### Phase 5: Post-Launch (1-2 Wochen)
- [ ] User-Feedback auswerten
- [ ] Performance-Optimierung
- [ ] SEO-Optimierung
- [ ] Social Media Launch
- [ ] Marketing (Reddit, Facebook-Gruppen)

---

## 🐛 Bekannte Issues

### Kritisch
- **Keine Datenbank-Persistenz** - Daten gehen bei Server-Restart verloren
- **Keine Email-Verifizierung** - Fake-Accounts möglich
- **Keine Rate-Limiting** - API kann überlastet werden

### Medium
- **GPX-Export ungetestet** - Könnte fehlerhaft sein
- **Mobile-UI nicht perfekt** - Kleine Layout-Issues
- **Keine Fehler-Logs** - Debugging schwierig

### Low
- **Keine Offline-Karten** - Nur Online nutzbar
- **Keine Höhenprofile** - Steigungen unbekannt
- **Keine Community-Features** - Keine User-Interaktion

---

## 💰 Kosten-Schätzung

### Entwicklung (bereits investiert)
- **Daten-Sammlung & Algorithmen:** ~20h
- **Backend-Entwicklung:** ~15h
- **Frontend-Entwicklung:** ~25h
- **Testing & Bugfixing:** ~10h
- **Gesamt:** ~70h Entwicklungszeit

### Hosting (monatlich)

#### MVP (kostenlos)
- Backend: Railway Free Tier → **0€**
- Frontend: Netlify Free Tier → **0€**
- OSRM API: Öffentlich → **0€**
- Domain: ~**1€/Monat**
- **Total: ~1€/Monat**

#### Production (nach Launch)
- Hetzner VPS (CX21): **~6€/Monat**
- PostgreSQL (Managed): **~10€/Monat**
- CDN (Cloudflare): **0€** (Free Tier)
- Domain: **~1€/Monat**
- Backup-Storage: **~2€/Monat**
- **Total: ~19€/Monat**

---

## 📈 Roadmap

### Version 1.0 (MVP) - Februar 2026
- ✅ Basis-Funktionalität
- ✅ Trip Planner
- ✅ Budget-Kalkulation
- 🔄 Deployment
- 🔄 Beta-Testing

### Version 1.1 - März 2026
- User-Accounts mit DB
- Routen speichern/laden
- Höhenprofile (SRTM)
- GPX-Export finalisieren

### Version 1.2 - April 2026
- POI-Integration (Camping, Tankstellen)
- Community-Bewertungen
- Foto-Upload UI
- Offline-Modus erweitern

### Version 2.0 - Q2 2026
- Mobile App (React Native)
- Eigener OSRM-Server
- Premium-Features
- Monetarisierung

---

## 🎯 Success Metrics

### MVP Launch
- [ ] 10 Beta-User testen erfolgreich
- [ ] Keine kritischen Bugs
- [ ] App läuft stabil 24/7
- [ ] Response-Time < 2 Sekunden

### 1 Monat nach Launch
- [ ] 100 registrierte User
- [ ] 50 geplante Routen
- [ ] 10 Community-Bewertungen
- [ ] 95% Uptime

### 3 Monate nach Launch
- [ ] 500 registrierte User
- [ ] 200 geplante Routen
- [ ] 50 Community-Bewertungen
- [ ] Break-even bei Hosting-Kosten

---

## 👥 Team & Kontakt

**Entwickler:** l2sr6t  
**Projekt-Start:** Januar 2026  
**Status:** MVP Phase  
**Repository:** `/Users/l2sr6t/Documents/Projekte/Budget Overlander`

---

## 📝 Notizen

### Technische Entscheidungen
- **Warum Vanilla JS?** Schneller Start, keine Build-Tools nötig
- **Warum File-based DB?** MVP-Prototyping, später PostgreSQL
- **Warum Leaflet?** Open Source, keine API-Kosten wie Google Maps
- **Warum OSRM?** Kostenlos, Open Source, weltweit verfügbar

### Lessons Learned
- Overpass-API ist perfekt für Offroad-Daten
- Clustering reduziert Komplexität massiv
- Budget-First Approach ist unique im Markt
- Community-Features sind wichtig für Retention

---

**Letzte Aktualisierung:** 8. Februar 2026, 11:58 Uhr
