#!/bin/bash
# Budget Overlander - Hetzner Cloud Setup Script
# Installiert: Node.js, PostgreSQL, PM2, Nginx, SSL

set -e

echo "🚀 Budget Overlander - Hetzner Setup"
echo "======================================"

# Update System
echo "📦 System aktualisieren..."
apt update && apt upgrade -y

# Node.js 18 installieren
echo "📦 Node.js 18 installieren..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# PostgreSQL installieren
echo "📦 PostgreSQL installieren..."
apt-get install -y postgresql postgresql-contrib

# PM2 installieren
echo "📦 PM2 installieren..."
npm install -g pm2

# Nginx installieren
echo "📦 Nginx installieren..."
apt-get install -y nginx

# Certbot für SSL
echo "📦 Certbot installieren..."
apt-get install -y certbot python3-certbot-nginx

# PostgreSQL konfigurieren
echo "🗄️ PostgreSQL einrichten..."
sudo -u postgres psql << EOF
CREATE DATABASE budget_overlander;
CREATE USER overlander WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE budget_overlander TO overlander;
\q
EOF

# Git Repository klonen
echo "📥 Repository klonen..."
cd /var/www
git clone https://github.com/morepixel/BudgetOverlander.git budget-overlander
cd budget-overlander

# Backend Dependencies installieren
echo "📦 Backend Dependencies..."
cd backend
npm install

# .env erstellen
echo "📝 .env Datei erstellen..."
cat > .env << EOF
PORT=3001
DATABASE_URL=postgresql://overlander:CHANGE_THIS_PASSWORD@localhost:5432/budget_overlander
OPENAI_API_KEY=DEIN_OPENAI_KEY
FLICKR_API_KEY=DEIN_FLICKR_KEY
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
EOF

echo "⚠️  WICHTIG: Bearbeite /var/www/budget-overlander/backend/.env"
echo "   - Setze OPENAI_API_KEY"
echo "   - Setze FLICKR_API_KEY"
echo "   - Ändere PostgreSQL Passwort"

# Germany-Daten importieren
echo "📊 Germany-Daten importieren (dauert ~10-15 Min)..."
node scripts/import-germany-data.js

# PM2 starten
echo "🚀 Backend mit PM2 starten..."
pm2 start server.js --name budget-overlander-api
pm2 startup
pm2 save

# Nginx konfigurieren
echo "🌐 Nginx konfigurieren..."
cat > /etc/nginx/sites-available/budget-overlander << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    # Frontend
    root /var/www/budget-overlander/frontend;
    index trip-planner.html;

    location / {
        try_files $uri $uri/ /trip-planner.html;
    }

    # Backend API
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

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
NGINXCONF

ln -sf /etc/nginx/sites-available/budget-overlander /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "✅ Installation abgeschlossen!"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Bearbeite: nano /var/www/budget-overlander/backend/.env"
echo "   - Setze OPENAI_API_KEY und FLICKR_API_KEY"
echo "2. Starte Backend neu: pm2 restart budget-overlander-api"
echo "3. Teste: http://DEINE_SERVER_IP/api/health"
echo "4. SSL einrichten: certbot --nginx -d deine-domain.de"
echo ""
echo "🎉 Budget Overlander läuft!"
