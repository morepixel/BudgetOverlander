# DaysLeft - Ressourcen-Tracker für Overlander

> "Wie lange reichen deine Ressourcen?"

## Was ist DaysLeft?

Eine Web-App die **alle Ressourcen deines Overlander-Fahrzeugs** trackt (Wasser, Strom, Diesel, Gas) und dir sagt wie lange du noch autark bleiben kannst.

## Features

- **Fahrzeug-Profile**: Definiere dein Setup (Tank-Größen, Verbrauchswerte)
- **Ressourcen-Tracking**: Wasser, Strom, Kraftstoff, Gas
- **Autarkie-Berechnung**: Wie viele Tage kannst du noch autark bleiben?
- **Quick-Actions**: Schnell Ressourcen auffrischen
- **Verbrauchshistorie**: Lerne deinen tatsächlichen Verbrauch

## Installation

```bash
npm install
npm start
```

## API Endpoints

- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Login
- `GET /api/vehicles` - Fahrzeuge abrufen
- `POST /api/vehicles` - Fahrzeug anlegen
- `GET /api/resources/current` - Aktuelle Füllstände
- `POST /api/resources/log` - Ressourcen-Eintrag

## Tech Stack

- **Backend**: Node.js / Express
- **Datenbank**: PostgreSQL
- **Frontend**: Vanilla JS, Leaflet Maps
- **Auth**: JWT
