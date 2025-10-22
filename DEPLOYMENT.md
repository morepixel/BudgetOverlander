# Deployment auf Mittwald vServer mit GitHub Actions

## Voraussetzungen

- Mittwald Managed vServer L 10.0 - SSD
- SSH-Zugang zum Server
- Domain (optional, aber empfohlen)
- GitHub Repository

---

## 1. Server-Vorbereitung (Einmalig)

### 1.1 SSH-Verbindung herstellen

```bash
ssh dein-user@dein-server.mittwald.io
```

### 1.2 Node.js installieren (falls nicht vorhanden)

```bash
# Node.js 18 LTS installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Prüfen
node --version  # sollte v18.x.x zeigen
npm --version
```

### 1.3 PostgreSQL installieren

```bash
# PostgreSQL installieren
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# PostgreSQL starten
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Datenbank erstellen
sudo -u postgres psql << EOF
CREATE DATABASE budget_overlander;
CREATE USER overlander WITH PASSWORD 'DEIN_SICHERES_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE budget_overlander TO overlander;
\q
EOF
```

### 1.4 PM2 installieren (Process Manager)

```bash
sudo npm install -g pm2
```

### 1.5 Git Repository klonen

```bash
# Projekt-Verzeichnis erstellen
mkdir -p /home/dein-user/budget-overlander
cd /home/dein-user/budget-overlander

# Repository klonen
git clone https://github.com/DEIN-USERNAME/budget-overlander.git .
```

### 1.6 Environment Variables einrichten

```bash
cd backend
nano .env
```

Füge folgendes ein:

```bash
PORT=3001
DATABASE_URL=postgresql://overlander:DEIN_PASSWORD@localhost:5432/budget_overlander
OPENAI_API_KEY=sk-...
FLICKR_API_KEY=...
JWT_SECRET=dein-super-geheimes-jwt-secret
NODE_ENV=production
```

### 1.7 Dependencies installieren & DB migrieren

```bash
cd /home/dein-user/budget-overlander/backend
npm install

# DB-Schema erstellen
node database/migrate-germany-data.js

# Germany-Daten importieren (dauert ~10-15 Min)
node scripts/import-germany-data.js
```

### 1.8 Backend mit PM2 starten

```bash
pm2 start server.js --name budget-overlander-api
pm2 startup  # Auto-Start bei Server-Neustart
pm2 save
```

### 1.9 Nginx konfigurieren

```bash
sudo nano /etc/nginx/sites-available/budget-overlander
```

Füge folgendes ein:

```nginx
server {
    listen 80;
    server_name budget-overlander.com www.budget-overlander.com;

    # Frontend (Statische Dateien)
    root /home/dein-user/budget-overlander/frontend;
    index trip-planner.html;

    # Frontend Routes
    location / {
        try_files $uri $uri/ /trip-planner.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

Aktiviere die Konfiguration:

```bash
sudo ln -s /etc/nginx/sites-available/budget-overlander /etc/nginx/sites-enabled/
sudo nginx -t  # Teste Konfiguration
sudo systemctl reload nginx
```

### 1.10 SSL-Zertifikat einrichten (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d budget-overlander.com -d www.budget-overlander.com
```

---

## 2. GitHub Actions Setup

### 2.1 SSH-Key generieren

Auf deinem **lokalen Rechner**:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/mittwald_deploy
```

### 2.2 Public Key auf Server hinterlegen

```bash
# Public Key anzeigen
cat ~/.ssh/mittwald_deploy.pub

# Auf Server: Public Key zu authorized_keys hinzufügen
ssh dein-user@dein-server.mittwald.io
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Füge den Public Key ein und speichere
chmod 600 ~/.ssh/authorized_keys
```

### 2.3 GitHub Secrets einrichten

Gehe zu deinem GitHub Repository:
**Settings → Secrets and variables → Actions → New repository secret**

Erstelle folgende Secrets:

| Secret Name | Wert |
|-------------|------|
| `MITTWALD_HOST` | `dein-server.mittwald.io` |
| `MITTWALD_USER` | `dein-username` |
| `MITTWALD_SSH_KEY` | Inhalt von `~/.ssh/mittwald_deploy` (Private Key!) |

### 2.4 Frontend API-URL anpassen

```bash
# Lokal in deinem Projekt
nano frontend/trip-planner.html
```

Ändere:
```javascript
const API_BASE_URL = 'http://localhost:3001/api';
```

Zu:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api'
    : '/api';  // Nutzt Nginx Proxy auf Production
```

---

## 3. Deployment testen

### 3.1 Ersten Deployment auslösen

```bash
# Lokal
git add .
git commit -m "feat: Setup GitHub Actions deployment"
git push origin main
```

### 3.2 Deployment-Status prüfen

- Gehe zu GitHub → Actions Tab
- Prüfe ob Workflow erfolgreich durchläuft
- Bei Fehler: Logs prüfen

### 3.3 Server-Status prüfen

```bash
# SSH auf Server
ssh dein-user@dein-server.mittwald.io

# PM2 Status
pm2 status
pm2 logs budget-overlander-api

# Nginx Status
sudo systemctl status nginx

# Test API
curl http://localhost:3001/api/health
```

### 3.4 Website testen

Öffne im Browser:
- `https://budget-overlander.com`
- Teste Route-Generierung
- Prüfe Browser-Console auf Fehler

---

## 4. Wartung & Monitoring

### 4.1 Logs anschauen

```bash
# Backend Logs
pm2 logs budget-overlander-api

# Nginx Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL Logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 4.2 Backend neu starten

```bash
pm2 restart budget-overlander-api
```

### 4.3 Datenbank-Backup

```bash
# Backup erstellen
pg_dump -U overlander budget_overlander > backup_$(date +%Y%m%d).sql

# Backup wiederherstellen
psql -U overlander budget_overlander < backup_20250122.sql
```

### 4.4 Server-Ressourcen prüfen

```bash
# CPU & RAM
htop

# Disk Space
df -h

# PostgreSQL Größe
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('budget_overlander'));"
```

---

## 5. Troubleshooting

### Problem: Backend startet nicht

```bash
pm2 logs budget-overlander-api --lines 100
# Prüfe auf Fehler in .env oder fehlende Dependencies
```

### Problem: 502 Bad Gateway

```bash
# Prüfe ob Backend läuft
pm2 status
curl http://localhost:3001/api/health

# Nginx neu starten
sudo systemctl restart nginx
```

### Problem: Datenbank-Verbindung fehlgeschlagen

```bash
# Prüfe PostgreSQL Status
sudo systemctl status postgresql

# Teste Verbindung
psql -U overlander -d budget_overlander -h localhost
```

### Problem: SSL-Zertifikat abgelaufen

```bash
# Certbot erneuern
sudo certbot renew
sudo systemctl reload nginx
```

---

## 6. Automatische Deployments

Jedes Mal wenn du Code auf `main` pushst, wird automatisch deployed:

```bash
git add .
git commit -m "feat: neue Feature"
git push origin main
```

GitHub Actions führt dann automatisch aus:
1. ✅ Code pullen
2. ✅ Dependencies installieren
3. ✅ Backend neu starten
4. ✅ Frontend aktualisieren

---

## 7. Kosten-Übersicht

| Service | Kosten/Monat |
|---------|--------------|
| Mittwald vServer L | ~20-30€ |
| Domain | ~1€ |
| SSL (Let's Encrypt) | Kostenlos |
| OpenAI API | ~5-20€ |
| **GESAMT** | **~26-51€/Monat** |

---

## Support

Bei Problemen:
1. Prüfe GitHub Actions Logs
2. Prüfe Server Logs (`pm2 logs`)
3. Prüfe Nginx Logs (`/var/log/nginx/`)
4. Prüfe PostgreSQL Logs

**Viel Erfolg! 🚀**
