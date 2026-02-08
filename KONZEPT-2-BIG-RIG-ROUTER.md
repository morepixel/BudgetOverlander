# Konzept 2: Big Rig Router

> "Google Maps für große Fahrzeuge"

---

## 🎯 Zusammenfassung

Eine Navigations-App die **Fahrzeug-Constraints** (Höhe, Breite, Gewicht, Länge) berücksichtigt und Routen berechnet die garantiert passierbar sind. Vermeidet niedrige Brücken, enge Straßen und Gewichtsbeschränkungen.

---

## ❌ Das Problem

### Overlander/Wohnmobil-Fahrer kennen das:

### 1. "Passt mein Fahrzeug durch?"
- Brücke: 3.2m Höhe - Mein Fuso: 3.1m... wird das eng?
- Tunnel in Italien - keine Ahnung ob ich durchpasse
- Enge Gasse in Spanien - bleibt mein Spiegel heil?

### 2. "Darf ich hier überhaupt fahren?"
- Gewichtsbeschränkungen auf Brücken
- LKW-Verbote auf Landstraßen
- Umweltzonen in Städten

### 3. "Google Maps schickt mich in die Katastrophe"
- Route durch 2.8m Unterführung → Dachschaden
- Wendepunkt auf Feldweg → Festgefahren
- "Schnellste Route" über Alpenpass → 10% Steigung mit 7.5t

### Reale Schäden:
- Durchschnittlich **2.000-10.000€** Schaden bei Brücken-Crashs
- Versicherung zahlt oft NICHT bei "vorhersehbarem" Schaden
- Zeitverlust, Stress, Urlaub ruiniert

---

## ✅ Die Lösung: Fahrzeug-spezifisches Routing

### Kernidee:
**Einmal Fahrzeug eingeben → Nie wieder Probleme**

---

## 🚗 Fahrzeug-Profil

User gibt ein:

| Parameter | Beispiel |
|-----------|----------|
| **Höhe** | 3.10 m |
| **Breite** | 2.30 m |
| **Länge** | 7.50 m |
| **Gewicht** | 7.500 kg |
| **Achslast** | 4.500 kg |

Optional:
- Überhang vorne/hinten
- Wendekreis
- Böschungswinkel (für Offroad)
- Wattiefe

---

## 🗺️ Was die App macht

### 1. Routing mit Constraints

Route vermeidet automatisch:
- ❌ Brücken unter 3.10m
- ❌ Straßen unter 2.30m Breite
- ❌ Brücken mit <7.5t Limit
- ❌ LKW-Verbotszonen
- ❌ Zu enge Kurven

### 2. Live-Warnungen

Während der Fahrt:
- ⚠️ "In 500m: Brücke 3.20m - knapp!"
- ⚠️ "Alternative Route wegen Gewichtslimit"
- ⚠️ "Enge Stelle in 200m - langsam fahren"

### 3. Hindernis-Karte

Zeigt auf der Karte:
- 🔴 Unpassierbar (zu niedrig/eng/schwer)
- 🟡 Kritisch (knapp, Vorsicht!)
- 🟢 Problemlos

### 4. Community-Updates

- "Diese Brücke ist niedriger als angegeben!"
- "Baustelle - aktuell nur 2.5m Durchfahrt"
- "Neue Umleitung wegen Brückenschaden"

---

## 📊 Datenquellen

### OpenStreetMap hat bereits:
- `maxheight` - Maximale Höhe
- `maxwidth` - Maximale Breite
- `maxweight` - Maximales Gewicht
- `maxlength` - Maximale Länge
- `maxaxleload` - Maximale Achslast
- `hgv` - LKW erlaubt/verboten

### Problem: Daten sind unvollständig
- Nur ~30% der Brücken haben Höhenangaben
- Gewichtslimits oft nicht erfasst
- Regionale Unterschiede

### Lösung: Hybrid-Ansatz
1. **OSM-Daten** als Basis
2. **Offizielle Daten** wo verfügbar (Straßenämter)
3. **Community-Daten** für Lücken
4. **Schätzungen** basierend auf Straßentyp

---

## 🏆 Konkurrenz-Analyse

### Existierende Lösungen:

| App | Preis | Qualität | Problem |
|-----|-------|----------|---------|
| **CoPilot Truck** | 15€/Jahr | Okay | Alte Karten, hässlich |
| **Sygic Truck** | 40€/Jahr | Gut | Teuer, keine Community |
| **TomTom GO** | 20€/Jahr | Okay | Nicht für Wohnmobile |
| **Google Maps** | Kostenlos | - | Keine LKW-Features |

### Warum wir besser sind:

1. **Moderneres UI** - Apps oben sind alle von 2015
2. **OSM-Daten** - Aktueller als kommerzielle Karten
3. **Community-Updates** - Echtzeit-Korrekturen
4. **Günstiger** - 5€/Monat vs. 40€/Jahr
5. **Overlander-fokussiert** - Nicht nur LKW

---

## 🎯 Zielgruppen

### Primär: Expeditionsfahrzeuge / Overlander
- 3.000-5.000 in DACH
- Fahrzeuge: Fuso, MAN, Unimog, umgebaute LKW
- Hohe Zahlungsbereitschaft
- Technisch affin

### Sekundär: Wohnmobil-Fahrer
- 500.000+ in DACH
- Fahrzeuge: Kastenwagen, Teilintegriert, Vollintegriert
- Mittlere Zahlungsbereitschaft
- Weniger technisch

### Tertiär: Transporter/Handwerker
- Sprinter, Crafter mit Aufbau
- B2B Potenzial
- Sehr preissensitiv

---

## 💰 Monetarisierung

### Free Tier
- Fahrzeugprofil anlegen
- Route planen (max 3/Tag)
- Basis-Warnungen
- Werbung

### Premium (5€/Monat | 50€/Jahr)
- Unbegrenzte Routen
- Offline-Karten
- Live-Navigation
- Community-Features
- Keine Werbung

### Pro (10€/Monat | 100€/Jahr)
- Alles aus Premium
- Multi-Fahrzeug-Profile
- Export für Navi-Geräte
- API-Zugang
- Priority Support

### B2B (auf Anfrage)
- Flottenmanagement
- Eigene Branding
- Integration in Logistik-Software

---

## 🛠️ Technische Umsetzung

### Routing-Engine

**Option A: OSRM mit Custom Profile**
- ✅ Bereits im Budget Overlander Setup
- ✅ Schnell und zuverlässig
- ❌ Custom Constraints komplex

**Option B: GraphHopper**
- ✅ Bessere LKW-Unterstützung
- ✅ Einfacher zu customizen
- ❌ Ressourcen-intensiver

**Option C: Valhalla**
- ✅ Sehr flexibel
- ✅ Native Truck-Profile
- ❌ Weniger Dokumentation

**Empfehlung:** GraphHopper oder Valhalla

### Daten-Pipeline

```
OSM Data → Filter Restrictions → Merge Community Data → Build Graph → Serve API
```

### Frontend

- **Web:** Progressive Web App (Leaflet)
- **Mobile:** React Native oder Flutter
- **Offline:** IndexedDB + Downloaded Tiles

---

## 📱 MVP Features (4-6 Wochen)

### Phase 1: Basics
1. Fahrzeugprofil anlegen (Höhe, Breite, Gewicht)
2. Route A→B mit Constraints
3. Warnung bei kritischen Stellen
4. Karte mit Hindernissen

### Phase 2: Navigation
5. Turn-by-Turn Navigation
6. Offline-Karten (Premium)
7. Live-Warnungen während Fahrt

### Phase 3: Community
8. Hindernis melden
9. Korrekturen einreichen
10. Bewertungen/Feedback

---

## ❓ Kritische Fragen

### 1. "Reichen OSM-Daten?"
**Teilweise.** Für Hauptstraßen gut, für Nebenstraßen lückenhaft. Lösung: Community + offizielle Daten.

### 2. "Haftung bei falschem Routing?"
**Disclaimer.** "Angaben ohne Gewähr, Fahrer bleibt verantwortlich." Standard bei allen Navi-Apps.

### 3. "Wie genau sind Community-Daten?"
**Verifizierung.** Mehrere Meldungen nötig bevor Änderung übernommen wird. Karma-System.

### 4. "Konkurrenz von Google Maps?"
**Unwahrscheinlich.** Google fokussiert auf Masse, nicht Nische. Truck-Routing ist B2B (Maps Platform).

### 5. "Warum sollte jemand von CoPilot wechseln?"
- Moderneres UI
- Bessere Karten (OSM)
- Community-Updates
- Günstiger
- Overlander-Fokus

---

## 📊 Marktpotenzial

### DACH-Region

| Segment | Fahrzeuge | Conversion | Preis | Revenue |
|---------|-----------|------------|-------|---------|
| Overlander | 5.000 | 30% | 100€/Jahr | 150.000€ |
| Wohnmobil | 500.000 | 5% | 50€/Jahr | 1.250.000€ |
| Transporter | 100.000 | 2% | 50€/Jahr | 100.000€ |

**Potenzial DACH:** ~1.5 Mio € ARR

### Europa
- 5x DACH = ~7.5 Mio € ARR Potenzial

---

## 🆚 Vergleich mit Konzept 1 (Quietcamp)

| Aspekt | Quietcamp | Big Rig Router |
|--------|-----------|----------------|
| **Problem** | Overtourism | Fahrzeug passt nicht |
| **Dringlichkeit** | "Nice to have" | "Must have" (Schadenvermeidung) |
| **Zielgruppe** | Alle Camper | Große Fahrzeuge |
| **Marktgröße** | Größer | Kleiner |
| **Monetarisierung** | Schwieriger | Einfacher (klarer Nutzen) |
| **Konkurrenz** | Park4Night | CoPilot, Sygic |
| **Differenzierung** | Neuartig | Besser als Status quo |
| **Technisch** | Einfacher | Komplexer |
| **MVP-Zeit** | 2-3 Wochen | 4-6 Wochen |

---

## ✅ Pro Big Rig Router
- **Klarer Schmerz** - Leute haben ECHTEN Schaden
- **Zahlungsbereitschaft** - 100€ vs. 5.000€ Reparatur ist easy
- **B2B Potenzial** - Speditionen, Handwerker
- **Weniger ethische Fragen** als Stellplatz-App

## ❌ Contra Big Rig Router
- **Kleinere Zielgruppe** - Nicht jeder hat großes Fahrzeug
- **Daten-Challenge** - OSM unvollständig
- **Technisch komplexer** - Routing-Engine customizen
- **Starke Konkurrenz** - CoPilot, Sygic existieren

---

## 🚀 Nächste Schritte

1. [ ] Marktvalidierung mit 10 Overlander-Interviews
2. [ ] OSM-Datenqualität in Zielregionen prüfen
3. [ ] GraphHopper/Valhalla Proof-of-Concept
4. [ ] Landing Page für Early Access
5. [ ] MVP mit Basis-Routing

---

*Erstellt: Februar 2026*  
*Status: Konzept*
