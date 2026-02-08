# GitHub Actions Setup für Hetzner Deployment

## 🎯 Was macht das?

Bei jedem `git push` auf `main` wird automatisch auf den Hetzner-Server deployed:
1. Code wird gepullt
2. Dependencies installiert
3. Backend neu gestartet
4. Nginx reloaded
5. Health-Check durchgeführt

---

## 🔧 Einmalige Einrichtung

### 1. SSH-Key für GitHub Actions erstellen

**Auf deinem lokalen Rechner:**

```bash
# SSH-Key generieren
ssh-keygen -t ed25519 -C "github-actions-hetzner" -f ~/.ssh/github_actions_hetzner

# Gibt 2 Dateien:
# - github_actions_hetzner (Private Key) → für GitHub Secrets
# - github_actions_hetzner.pub (Public Key) → für Hetzner Server
```

### 2. Public Key auf Hetzner-Server hinterlegen

```bash
# Public Key anzeigen
cat ~/.ssh/github_actions_hetzner.pub

# Auf Hetzner-Server einloggen
ssh root@ubuntu-4gb-hel1-1

# Public Key zu authorized_keys hinzufügen
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Füge den Public Key ein (neue Zeile)
# Speichern: Ctrl+O, Enter, Ctrl+X

# Permissions setzen
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 3. GitHub Secrets einrichten

Gehe zu: https://github.com/morepixel/BudgetOverlander/settings/secrets/actions

Klicke **"New repository secret"** und erstelle:

#### Secret 1: HETZNER_HOST
```
Name: HETZNER_HOST
Value: ubuntu-4gb-hel1-1  (oder die IP-Adresse)
```

#### Secret 2: HETZNER_USER
```
Name: HETZNER_USER
Value: root
```

#### Secret 3: HETZNER_SSH_KEY
```
Name: HETZNER_SSH_KEY
Value: [Inhalt von ~/.ssh/github_actions_hetzner]
```

**Private Key anzeigen:**
```bash
cat ~/.ssh/github_actions_hetzner
```

Kopiere **ALLES** (inkl. `-----BEGIN OPENSSH PRIVATE KEY-----` und `-----END OPENSSH PRIVATE KEY-----`)

---

## 🚀 Deployment testen

### 1. Workflow-Datei committen

```bash
# Lokal in deinem Projekt
cd /Users/l2sr6t/Documents/Projekte/Budget\ Overlander

git add .github/workflows/deploy-hetzner.yml
git commit -m "feat: Add GitHub Actions deployment"
git push origin main
```

### 2. Deployment-Status prüfen

1. Gehe zu: https://github.com/morepixel/BudgetOverlander/actions
2. Klicke auf den neuesten Workflow-Run
3. Prüfe die Logs

**Erwartete Ausgabe:**
```
✅ Checkout code
✅ Deploy to Hetzner via SSH
  🚀 Starting deployment...
  📥 Pulling latest code from GitHub...
  📦 Installing backend dependencies...
  🔄 Restarting backend...
  ✅ Frontend updated (static files)
  🔄 Reloading Nginx...
  ✅ Deployment completed successfully!
✅ Health Check
  🏥 Checking API health...
  ✅ API is healthy!
```

### 3. Website testen

Öffne: http://budget.wirkstoff.com/app.html?region=pyrenees

---

## 🔄 Normaler Workflow (ab jetzt)

```bash
# Lokal entwickeln
nano frontend/app.html  # oder backend/server.js

# Committen & Pushen
git add .
git commit -m "feat: neue Feature"
git push origin main

# GitHub Actions deployed automatisch! 🎉
```

**Deployment dauert ca. 1-2 Minuten.**

---

## 🐛 Troubleshooting

### Problem: "Permission denied (publickey)"

**Lösung:** SSH-Key nicht korrekt hinterlegt

```bash
# Auf Hetzner-Server prüfen
cat ~/.ssh/authorized_keys

# Stelle sicher, dass der Public Key drin ist
```

### Problem: "pm2: command not found"

**Lösung:** PM2 ist nicht installiert

```bash
# Auf Hetzner-Server
npm install -g pm2
```

### Problem: "git pull failed"

**Lösung:** Git-Repo ist nicht korrekt geklont

```bash
# Auf Hetzner-Server
cd /var/www/budget-overlander
git remote -v
# Sollte zeigen: origin  https://github.com/morepixel/BudgetOverlander.git

# Falls nicht:
git remote set-url origin https://github.com/morepixel/BudgetOverlander.git
```

### Problem: Health Check schlägt fehl

**Lösung:** Backend ist nicht gestartet

```bash
# Auf Hetzner-Server
pm2 status
pm2 logs budget-overlander-api --lines 50
```

---

## 📊 Workflow-Optionen

### Manuelles Deployment auslösen

Gehe zu: https://github.com/morepixel/BudgetOverlander/actions/workflows/deploy-hetzner.yml

Klicke **"Run workflow"** → **"Run workflow"**

### Deployment auf bestimmten Branch

Ändere in `.github/workflows/deploy-hetzner.yml`:

```yaml
'on':
  push:
    branches:
      - main
      - develop  # ← Füge weitere Branches hinzu
```

### Deployment nur bei bestimmten Dateien

```yaml
'on':
  push:
    branches:
      - main
    paths:
      - 'backend/**'
      - 'frontend/**'
      - '.github/workflows/**'
```

---

## 🔒 Sicherheit

### Best Practices

1. ✅ **Niemals** Private Keys im Code committen
2. ✅ Nutze GitHub Secrets für sensible Daten
3. ✅ SSH-Key nur für Deployment (nicht für andere Zwecke)
4. ✅ Regelmäßig Keys rotieren (alle 6-12 Monate)

### SSH-Key rotieren

```bash
# Neuen Key generieren
ssh-keygen -t ed25519 -C "github-actions-hetzner-2026" -f ~/.ssh/github_actions_hetzner_new

# Auf Server: Alten Key entfernen, neuen hinzufügen
ssh root@ubuntu-4gb-hel1-1
nano ~/.ssh/authorized_keys

# In GitHub: Secret HETZNER_SSH_KEY aktualisieren
```

---

## 📈 Erweiterte Features (Optional)

### Slack-Benachrichtigung bei Deployment

Füge am Ende von `.github/workflows/deploy-hetzner.yml` hinzu:

```yaml
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Rollback bei Fehler

```yaml
      - name: Rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /var/www/budget-overlander
            git reset --hard HEAD~1
            pm2 restart budget-overlander-api
```

### Deployment-Umgebungen (Staging/Production)

Erstelle separate Workflows:
- `.github/workflows/deploy-staging.yml` (für `develop` Branch)
- `.github/workflows/deploy-production.yml` (für `main` Branch)

---

## ✅ Checkliste

- [ ] SSH-Key generiert
- [ ] Public Key auf Hetzner-Server hinterlegt
- [ ] GitHub Secrets eingerichtet (3 Stück)
- [ ] Workflow-Datei committet
- [ ] Erstes Deployment getestet
- [ ] Website funktioniert

---

**Viel Erfolg! 🚀**

Bei Fragen: Prüfe die GitHub Actions Logs oder die Server-Logs (`pm2 logs`)
