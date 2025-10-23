# Deployment auf Railway.app

Railway.app ist eine moderne Platform-as-a-Service (PaaS) die perfekt für Node.js + PostgreSQL Apps ist.

## Vorteile von Railway

- ✅ **PostgreSQL** inklusive (managed)
- ✅ **Node.js** Support
- ✅ **Automatische Deployments** via GitHub
- ✅ **SSL/HTTPS** automatisch
- ✅ **Einfaches Setup** (kein Server-Management)
- ✅ **Kostenlos starten** ($5 Guthaben/Monat)

## Kosten

- **Starter Plan:** $5/Monat Guthaben (kostenlos)
- **Danach:** Pay-as-you-go (~$10-20/Monat je nach Traffic)
- **PostgreSQL:** Inklusive (keine Extra-Kosten)

---

## Setup-Anleitung

### 1. Railway Account erstellen

1. Gehe zu: https://railway.app/
2. Klicke **"Start a New Project"**
3. Login mit **GitHub** (empfohlen für Auto-Deploy)

### 2. Neues Projekt erstellen

1. **"New Project"** → **"Deploy from GitHub repo"**
2. Wähle dein Repository: `Budget-Overlander`
3. Railway erkennt automatisch Node.js

### 3. PostgreSQL Datenbank hinzufügen

1. Im Projekt: **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway erstellt automatisch eine PostgreSQL-Datenbank
3. Connection String wird automatisch als Environment Variable verfügbar: `DATABASE_URL`

### 4. Environment Variables setzen

Im Railway Dashboard → Dein Service → **"Variables"**:

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Automatisch von Railway gesetzt
OPENAI_API_KEY=sk-dein-key-hier
FLICKR_API_KEY=dein-flickr-key
JWT_SECRET=dein-super-geheimes-jwt-secret
```

**Wichtig:** `DATABASE_URL` wird automatisch von Railway gesetzt wenn du PostgreSQL hinzufügst!

### 5. Backend-Service konfigurieren

Railway braucht zu wissen wie deine App gestartet wird.

**Option A: Start Command setzen**

Im Railway Dashboard → Service → **"Settings"** → **"Start Command"**:
```bash
cd backend && npm start
```

**Option B: Root-Level package.json erstellen** (empfohlen)

Erstelle im Root-Verzeichnis eine `package.json`:

```json
{
  "name": "budget-overlander",
  "version": "1.0.0",
  "scripts": {
    "start": "cd backend && npm start",
    "install": "cd backend && npm install"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### 6. Datenbank initialisieren

Nach dem ersten Deployment musst du die Germany-Daten importieren.

**Via Railway CLI:**

```bash
# Railway CLI installieren
npm install -g @railway/cli

# Login
railway login

# Mit deinem Projekt verbinden
railway link

# Shell auf dem Server öffnen
railway run bash

# Im Container:
cd backend
node database/migrate-germany-data.js
node scripts/import-germany-data.js  # Dauert ~10-15 Min
```

**Oder via Datenbank-Dump:**

1. Lokal Datenbank exportieren:
```bash
pg_dump -U overlander budget_overlander > germany_data.sql
```

2. In Railway importieren:
```bash
railway connect postgres
# Dann im psql:
\i germany_data.sql
```

### 7. Frontend deployen

Railway ist primär für Backend. Für Frontend hast du 2 Optionen:

**Option A: Statisches Hosting (Netlify/Vercel) - Empfohlen**

1. Frontend separat auf Netlify/Vercel deployen (kostenlos)
2. API-URL in Frontend auf Railway-URL setzen

**Option B: Frontend über Railway Backend ausliefern**

Backend erweitern um statische Dateien zu servieren:

```javascript
// In backend/server.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback für SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/trip-planner.html'));
  }
});
```

### 8. Custom Domain (Optional)

1. Railway Dashboard → Service → **"Settings"** → **"Domains"**
2. **"Custom Domain"** → Deine Domain eingeben
3. DNS-Records bei deinem Domain-Anbieter setzen:
   - CNAME: `deine-domain.de` → `dein-projekt.up.railway.app`

---

## Automatische Deployments

Railway deployed automatisch bei jedem Push auf `main`:

```bash
git add .
git commit -m "feat: neue Features"
git push origin main
```

Railway erkennt den Push und deployed automatisch! 🚀

---

## Monitoring & Logs

### Logs anschauen

Railway Dashboard → Dein Service → **"Deployments"** → **"View Logs"**

### Metriken

Railway Dashboard → Dein Service → **"Metrics"**
- CPU Usage
- Memory Usage
- Network Traffic

### Datenbank-Zugriff

```bash
# Via Railway CLI
railway connect postgres

# Oder via Connection String
psql $DATABASE_URL
```

---

## Kosten-Übersicht

Railway berechnet nach Ressourcen-Verbrauch:

| Ressource | Preis | Dein Verbrauch (geschätzt) |
|-----------|-------|----------------------------|
| CPU | $0.000463/min | ~$3-5/Monat |
| RAM | $0.000231/GB/min | ~$2-3/Monat |
| PostgreSQL | Inklusive | $0 |
| Network | $0.10/GB | ~$1-2/Monat |
| **GESAMT** | | **~$6-10/Monat** |

**Starter Plan:** $5 Guthaben kostenlos jeden Monat!

---

## Troubleshooting

### Problem: Build schlägt fehl

**Lösung:** Prüfe ob `package.json` im Root existiert oder Start Command gesetzt ist.

### Problem: Datenbank-Verbindung fehlgeschlagen

**Lösung:** Prüfe ob `DATABASE_URL` Environment Variable gesetzt ist:
```bash
railway variables
```

### Problem: Port-Fehler

**Lösung:** Railway setzt automatisch `PORT` Variable. Stelle sicher dein Backend nutzt:
```javascript
const PORT = process.env.PORT || 3001;
```

### Problem: Germany-Daten nicht importiert

**Lösung:** Führe Import-Script manuell aus:
```bash
railway run bash
cd backend
node scripts/import-germany-data.js
```

---

## Migration von lokal zu Railway

### 1. Lokale Datenbank exportieren

```bash
pg_dump -U overlander budget_overlander > backup.sql
```

### 2. Zu Railway importieren

```bash
railway connect postgres
\i backup.sql
```

### 3. Environment Variables kopieren

Kopiere alle Werte aus deiner lokalen `.env` zu Railway Variables.

---

## Vorteile Railway vs. Hetzner

| | Railway | Hetzner Cloud |
|---|---|---|
| Setup-Zeit | 5 Minuten | 1-2 Stunden |
| Server-Management | ❌ Nicht nötig | ✅ Du musst alles machen |
| PostgreSQL | ✅ Managed | ⚙️ Selbst installieren |
| Auto-Deploy | ✅ Ja | ⚙️ GitHub Actions nötig |
| SSL/HTTPS | ✅ Automatisch | ⚙️ Certbot einrichten |
| Backups | ✅ Automatisch | ⚙️ Selbst einrichten |
| Kosten | ~$6-10/Monat | ~$5/Monat |

---

## Nächste Schritte

1. ✅ Railway Account erstellen
2. ✅ Projekt aus GitHub deployen
3. ✅ PostgreSQL hinzufügen
4. ✅ Environment Variables setzen
5. ✅ Germany-Daten importieren
6. ✅ Testen!

**Los geht's! 🚀**
