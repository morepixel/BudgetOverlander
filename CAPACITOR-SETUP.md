# DaysLeft - Capacitor Native App Setup

## Übersicht

Die DaysLeft Web-App ist jetzt als native iOS/Android App verfügbar.

## Projektstruktur

```
frontend/
├── ios/                    # iOS Xcode Projekt
├── android/                # Android Studio Projekt
├── www/                    # Build-Output (wird automatisch generiert)
├── js/
│   └── capacitor-bridge.js # Native Features Bridge
├── capacitor.config.ts     # Capacitor Konfiguration
└── package.json            # NPM Scripts
```

## Voraussetzungen

### iOS
- macOS mit Xcode 15+
- iOS Simulator oder echtes Gerät
- Apple Developer Account (für App Store)

### Android
- Android Studio
- Android SDK 33+
- Emulator oder echtes Gerät

## Commands

```bash
cd frontend

# Web-Assets bauen und synchronisieren
npm run cap:sync

# iOS App in Xcode öffnen
npm run cap:ios

# Android App in Android Studio öffnen
npm run cap:android

# iOS direkt auf Gerät/Simulator starten
npm run cap:run:ios

# Android direkt auf Gerät/Emulator starten
npm run cap:run:android
```

## Native Features

### 1. Offline-Support
- Automatisches Caching aller API-Responses
- Sync-Queue für Änderungen wenn offline
- Offline-Banner wenn keine Verbindung

### 2. Local Notifications
- Warnung bei niedrigen Ressourcen
- Tägliche Erinnerung (optional)

### 3. StatusBar
- Native StatusBar-Integration
- DaysLeft-Grün (#1a3a1a)

## API Konfiguration

Die App verwendet standardmäßig die Live-API:
```
https://budget-overlander.moremedia.de/api
```

Für lokale Entwicklung in `capacitor.config.ts`:
```typescript
server: {
  url: 'http://localhost:3001',
  cleartext: true
}
```

## App Store Veröffentlichung

### iOS App Store
1. `npm run cap:ios` - Xcode öffnen
2. Signing & Capabilities konfigurieren
3. Archive > Distribute App

### Google Play Store
1. `npm run cap:android` - Android Studio öffnen
2. Build > Generate Signed Bundle/APK
3. In Play Console hochladen

## Icons & Splash Screen

Icons müssen noch erstellt werden:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/mipmap-*/`

Empfohlen: [capacitor-assets](https://github.com/ionic-team/capacitor-assets)

```bash
npx @capacitor/assets generate --iconBackgroundColor '#1a3a1a' --splashBackgroundColor '#1a3a1a'
```

## Plugins

Installierte Capacitor Plugins:
- `@capacitor/app` - App Lifecycle
- `@capacitor/preferences` - Offline Storage
- `@capacitor/network` - Netzwerk-Status
- `@capacitor/local-notifications` - Push Notifications
- `@capacitor/status-bar` - Native StatusBar
- `@capacitor/splash-screen` - Splash Screen
