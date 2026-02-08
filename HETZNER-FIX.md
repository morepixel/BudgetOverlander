# Hetzner Server - 500 Error Fix

## Problem
Die API gibt einen 500 Internal Server Error zurück, weil die Datenbank-Verbindungsdaten in der `.env` Datei fehlen.

## Lösung

### Auf dem Hetzner Server ausführen:

```bash
# 1. Ins Backend-Verzeichnis wechseln
cd /var/www/budget-overlander/backend

# 2. Neueste Version vom Git pullen
git pull origin main

# 3. Update-Skript ausführbar machen
chmod +x ../update-hetzner-env.sh

# 4. Update-Skript ausführen
../update-hetzner-env.sh

# 5. Datenbank initialisieren
node init-database.js

# 6. Backend neu starten
pm2 restart budget-overlander-api

# 7. Logs prüfen
pm2 logs budget-overlander-api --lines 50
```

### API Keys setzen (falls noch nicht geschehen)

```bash
# .env bearbeiten
nano .env

# Setze:
# OPENAI_API_KEY=dein-openai-key
# FLICKR_API_KEY=dein-flickr-key

# Backend neu starten
pm2 restart budget-overlander-api
```

### Testen

```bash
# Health Check
curl http://localhost:3001/api/health

# Von außen testen
curl http://46.62.251.84/api/health

# Register testen
curl -X POST http://46.62.251.84/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

## Was wurde geändert?

1. **`.env.example`** - Datenbank-Variablen hinzugefügt
2. **`setup-hetzner.sh`** - Automatische Generierung der DB-Credentials
3. **`update-hetzner-env.sh`** - Neues Skript zum Update der .env auf dem Server
4. **`init-database.js`** - Skript zur Datenbank-Initialisierung

## Fehlerbehebung

### Fehler: "Connection refused"
```bash
# PostgreSQL Status prüfen
sudo systemctl status postgresql

# PostgreSQL starten
sudo systemctl start postgresql
```

### Fehler: "database does not exist"
```bash
# Datenbank manuell erstellen
sudo -u postgres psql
CREATE DATABASE budget_overlander;
CREATE USER overlander WITH PASSWORD 'DEIN_PASSWORT';
GRANT ALL PRIVILEGES ON DATABASE budget_overlander TO overlander;
ALTER DATABASE budget_overlander OWNER TO overlander;
\q
```

### Fehler: "authentication failed"
```bash
# Passwort in .env prüfen
grep DB_PASSWORD .env

# PostgreSQL User-Passwort zurücksetzen
sudo -u postgres psql
ALTER USER overlander WITH PASSWORD 'NEUES_PASSWORT';
\q

# Passwort in .env aktualisieren
nano .env
```

## PM2 Befehle

```bash
# Status anzeigen
pm2 status

# Logs anzeigen
pm2 logs budget-overlander-api

# Neustart
pm2 restart budget-overlander-api

# Stop
pm2 stop budget-overlander-api

# Start
pm2 start budget-overlander-api
```
