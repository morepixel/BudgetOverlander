#!/bin/bash
# Budget Overlander - Update .env auf Hetzner Server
# Dieses Skript aktualisiert die .env Datei mit den korrekten Datenbank-Credentials

set -e

echo "🔧 Budget Overlander - .env Update"
echo "===================================="

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "server.js" ]; then
    echo "❌ Fehler: server.js nicht gefunden. Bitte im backend/ Verzeichnis ausführen!"
    exit 1
fi

# Backup der alten .env
if [ -f ".env" ]; then
    echo "📦 Backup der alten .env..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Lese das PostgreSQL Passwort aus der bestehenden .env oder generiere ein neues
if [ -f ".env" ] && grep -q "DB_PASSWORD=" .env; then
    DB_PASSWORD=$(grep "DB_PASSWORD=" .env | cut -d '=' -f2)
    echo "✅ Verwende bestehendes DB Passwort"
else
    DB_PASSWORD=$(openssl rand -base64 32)
    echo "🔑 Neues DB Passwort generiert"
fi

# Lese JWT Secret aus der bestehenden .env oder generiere ein neues
if [ -f ".env" ] && grep -q "JWT_SECRET=" .env; then
    JWT_SECRET=$(grep "JWT_SECRET=" .env | cut -d '=' -f2)
    echo "✅ Verwende bestehendes JWT Secret"
else
    JWT_SECRET=$(openssl rand -base64 32)
    echo "🔑 Neues JWT Secret generiert"
fi

# Lese API Keys aus der bestehenden .env
OPENAI_KEY=""
FLICKR_KEY=""
if [ -f ".env" ]; then
    OPENAI_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d '=' -f2 || echo "")
    FLICKR_KEY=$(grep "FLICKR_API_KEY=" .env | cut -d '=' -f2 || echo "")
fi

# Erstelle neue .env Datei
echo "📝 Erstelle neue .env Datei..."
cat > .env << EOF
PORT=3001
NODE_ENV=production

# Database
DB_USER=overlander
DB_HOST=localhost
DB_NAME=budget_overlander
DB_PASSWORD=${DB_PASSWORD}
DB_PORT=5432

# JWT
JWT_SECRET=${JWT_SECRET}

# API Keys
OPENAI_API_KEY=${OPENAI_KEY}
FLICKR_API_KEY=${FLICKR_KEY}
EOF

echo ""
echo "✅ .env Datei aktualisiert!"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Prüfe die .env Datei: cat .env"
echo "2. Setze API Keys falls nötig: nano .env"
echo "3. Initialisiere Datenbank: node -e \"import('./database/db-postgres.js').then(m => m.initializeDatabase())\""
echo "4. Starte Backend neu: pm2 restart budget-overlander-api"
echo "5. Prüfe Logs: pm2 logs budget-overlander-api"
echo ""
