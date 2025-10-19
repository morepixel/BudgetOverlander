# TrailQuest Offgrid - Setup Guide

## 🚀 Quick Start

### 1. PostgreSQL Setup

```bash
# Installation läuft bereits via Homebrew
brew install postgresql postgis

# Nach Installation: Postgres starten
brew services start postgresql

# Datenbank erstellen
createdb trailquest

# PostGIS Extension aktivieren
psql trailquest -c "CREATE EXTENSION postgis;"
```

### 2. Datenbank initialisieren

```bash
cd backend

# Schema erstellen & Sample-Daten laden
node database/migrate.js
```

Dies erstellt:
- ✅ Alle Tabellen (users, vehicles, quests, badges, etc.)
- ✅ PostGIS Extension
- ✅ Sample Quests (Pyrenäen)
- ✅ Default Badges
- ✅ Migriert bestehende JSON-Daten

### 3. Backend starten

```bash
cd backend
npm install
npm start
```

Server läuft auf: http://localhost:3001

## 📊 Neue API-Endpoints

### Quests

```bash
# Quests in der Nähe
GET /api/quests/nearby?lat=42.8&lon=0.5&radius=50

# Quests nach Region
GET /api/quests/region/pyrenees

# Quest starten
POST /api/quests/:id/start

# Quest abschließen
POST /api/quests/:id/complete

# Quest-Fortschritt
GET /api/quests/progress
```

### Badges

```bash
# Alle Badges
GET /api/badges

# User's Badges
GET /api/badges/user

# Badge-Fortschritt
GET /api/badges/progress
```

### Profile

```bash
# User-Profil mit Stats
GET /api/profile

# Stats aktualisieren
POST /api/profile/update-stats
{
  "distance_km": 120,
  "offroad_km": 80,
  "elevation_m": 1500
}

# Leaderboard
GET /api/profile/leaderboard?type=xp&limit=10
```

## 🎮 Game-Mechanik

### XP-System

- **Quest abschließen:** +100-300 XP
- **Level-Up:** Automatisch bei XP-Schwelle
- **Level-Formel:** `Level = floor(sqrt(XP / 100)) + 1`

### Quest-Typen

1. **discover:** Besuche POI (Wasserfall, Aussichtspunkt)
2. **distance:** Fahre X km Offroad
3. **elevation:** Überwinde X Höhenmeter
4. **difficulty:** Fahre Track mit Schwierigkeit > 70
5. **photo:** Mache Foto an Location

### Badges

- 🏔️ **Mountain Goat:** 5000m Elevation
- 🌊 **Water Hunter:** 10 Wasserquellen
- 🏕️ **Wild Camper:** 20 Wildcamps
- 🚙 **Offroad King:** 500km Offroad
- 📸 **Photographer:** 50 Fotos
- ⭐ **Explorer:** Level 5
- 🎯 **Quest Master:** 50 Quests

## 🧪 Testen

### 1. User registrieren

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Speichere den Token!

### 3. Quests abrufen

```bash
curl http://localhost:3001/api/quests/region/pyrenees \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Quest abschließen

```bash
curl -X POST http://localhost:3001/api/quests/1/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Profil anzeigen

```bash
curl http://localhost:3001/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📁 Datenbank-Schema

### Wichtigste Tabellen

**users**
- id, email, password_hash, name
- xp, level (auto-calculated)
- created_at, updated_at

**quests**
- id, name, description, type
- coordinates (PostGIS GEOGRAPHY)
- reward_xp, difficulty, region

**user_progress**
- user_id, quest_id
- status (pending, in_progress, completed)
- progress (0-100%), completed_at

**badges**
- id, name, description, icon
- requirement_type, requirement_value

**user_stats**
- user_id
- total_distance_km, total_offroad_km
- total_elevation_m, total_quests_completed

## 🔧 Troubleshooting

### Postgres läuft nicht

```bash
brew services start postgresql
```

### Datenbank existiert nicht

```bash
createdb trailquest
psql trailquest -c "CREATE EXTENSION postgis;"
```

### Migration-Fehler

```bash
# Datenbank neu erstellen
dropdb trailquest
createdb trailquest
psql trailquest -c "CREATE EXTENSION postgis;"
node database/migrate.js
```

### Port-Konflikt

```bash
# Backend-Port in .env ändern
PORT=3002
```

## 📊 Nächste Schritte

1. ✅ Postgres Setup
2. ✅ Game-Service (Quests, Badges, XP)
3. ⏳ Frontend-Integration
4. ⏳ Elevation-Service (SRTM)
5. ⏳ Ein-Klick-Tour Generator
6. ⏳ Offline-Bundle

## 🎯 Frontend-Integration (nächster Schritt)

```javascript
// Quest-Anzeige auf Karte
async function loadQuests() {
  const response = await api.get('/quests/nearby?lat=42.8&lon=0.5&radius=50');
  const quests = response.quests;
  
  quests.forEach(quest => {
    L.marker([quest.lat, quest.lon], {
      icon: L.divIcon({
        html: `<div class="quest-marker">${getQuestIcon(quest.type)}</div>`
      })
    }).addTo(map).bindPopup(`
      <h3>${quest.name}</h3>
      <p>${quest.description}</p>
      <p>XP: ${quest.reward_xp}</p>
      <button onclick="completeQuest(${quest.id})">Abschließen</button>
    `);
  });
}
```

## 📖 API-Dokumentation

Vollständige API-Docs: siehe `TRAILQUEST-ARCHITECTURE.md`
