# Konzept 3: DaysLeft

> "Wie lange reichen deine Ressourcen?"

---

## 🎯 Zusammenfassung

Eine App die **alle Ressourcen deines Overlander-Fahrzeugs** trackt (Wasser, Strom, Diesel, Gas) und dir sagt wie lange du noch autark bleiben kannst. Plus: Zeigt Versorgungsstellen in der Nähe wenn Ressourcen knapp werden.

---

## ❌ Das Problem

### Overlander fragen sich ständig:

### 1. "Wie lange kann ich noch autark stehen?"
- 100L Wassertank - aber wieviel verbrauche ich?
- Batterie bei 60% - reicht das für 3 Tage?
- Solar bringt weniger als gedacht - was nun?

### 2. "Wann muss ich zur nächsten Versorgung?"
- Wo ist die nächste Frischwasser-Stelle?
- Wo kann ich Grauwasser entsorgen?
- Wo gibt's LPG für meinen Gastank?

### 3. "Schaffe ich es bis zum nächsten Spot?"
- 50L Diesel im Tank, 300km bis zur Tanke
- Bergige Strecke = mehr Verbrauch
- Will ich das Risiko eingehen?

### Das echte Problem:
- **Kopfrechnen** während man eigentlich entspannen will
- **Unsicherheit** ob man es noch schafft
- **Umwege** weil man "lieber auf Nummer sicher" geht
- **Stress** statt Freiheit

---

## ✅ Die Lösung: Intelligenter Ressourcen-Tracker

### Kernidee:
**Dein Fahrzeug als digitaler Zwilling - immer wissen wo du stehst**

---

## 🚐 Fahrzeug-Setup (einmalig)

User gibt sein Setup ein:

### Wasser
| Parameter | Beispiel |
|-----------|----------|
| **Frischwasser-Tank** | 100 L |
| **Grauwasser-Tank** | 80 L |
| **Verbrauch/Tag** | 15 L (wird gelernt) |

### Strom
| Parameter | Beispiel |
|-----------|----------|
| **Batterie-Kapazität** | 200 Ah (LiFePO4) |
| **Solar-Leistung** | 300 Wp |
| **Verbrauch/Tag** | 50 Ah (wird gelernt) |
| **Landstrom-Ladegerät** | 30 A |

### Kraftstoff
| Parameter | Beispiel |
|-----------|----------|
| **Tankgröße** | 80 L Diesel |
| **Verbrauch** | 12 L/100km |
| **Zusatztank** | 40 L |

### Gas
| Parameter | Beispiel |
|-----------|----------|
| **Flaschen** | 2x 11kg Propan |
| **Verbrauch/Tag** | 0.3 kg (Kochen + Heizen) |

---

## 📊 Was die App zeigt

### Dashboard (Hauptansicht)

```
┌─────────────────────────────────────┐
│  💧 WASSER      ████████░░  78%     │
│     62L / 100L   ~4 Tage            │
│                                     │
│  🔋 BATTERIE    ██████████  95%     │
│     190Ah / 200Ah  ~3.8 Tage        │
│                                     │
│  ⛽ DIESEL      ██████░░░░  55%     │
│     44L / 80L   ~370 km             │
│                                     │
│  🔥 GAS         ████░░░░░░  40%     │
│     8.8kg / 22kg  ~29 Tage          │
└─────────────────────────────────────┘

⚠️ Wasser wird knapp in 4 Tagen
   Nächste Versorgung: 12km entfernt
```

### Karten-Ansicht

Zeigt in der Nähe:
- 💧 Frischwasser-Stellen
- 🚰 Entsorgungsstationen
- ⛽ Tankstellen (mit Diesel/LPG)
- 🔌 Landstrom-Möglichkeiten
- 🔥 Gas-Füllstationen

Mit Filter: "Zeige nur was ich in den nächsten 3 Tagen brauche"

---

## 🧠 Intelligente Features

### 1. Auto-Tracking (optional)

**Mit Bluetooth-Sensoren:**
- Wassertank-Füllstand (Sensor ~30€)
- Batterie-SOC via Victron/Bluetooth
- GPS-Tracking für Diesel-Verbrauch

**Ohne Sensoren:**
- Manuelle Eingabe ("Heute 20L getankt")
- Schätzung basierend auf Nutzungsmuster

### 2. Lernender Verbrauch

App lernt DEIN Verhalten:
- "Du verbrauchst im Schnitt 18L Wasser/Tag"
- "Bei Hitze steigt dein Stromverbrauch um 30%"
- "Bergfahrten: +3L Diesel/100km"

### 3. Wetter-Integration

- Sonnenschein → Mehr Solar-Ertrag → Batterie hält länger
- Regen → Weniger Solar → Warnung
- Kälte → Mehr Gas-Verbrauch für Heizung

### 4. Routen-Planung mit Ressourcen

**Statt:** "Ich fahre 500km nach Süden"
**Besser:** "Du brauchst ~60L Diesel. Tankstopp nach 320km empfohlen. Wasser reicht, Strom knapp."

### 5. Notfall-Modus

"Ich habe nur noch 20L Wasser - was tun?"
- Zeigt ALLE Optionen in Reichweite
- Sortiert nach Entfernung
- Zeigt Öffnungszeiten
- Ein-Klick-Navigation

---

## 🗺️ Datenquellen für Versorgungsstellen

### Existierende Daten:
- **OSM:** Tankstellen, Wasserstellen (teilweise)
- **Park4Night:** Entsorgungsstationen
- **LPG-App:** Gas-Tankstellen
- **Caramaps:** Ver-/Entsorgung

### Eigene Daten:
- Community-Meldungen
- Verifizierte Stellen
- Öffnungszeiten, Preise, Bewertungen

---

## 🎯 Zielgruppe

### Primär: Langzeit-Overlander
- Wochen/Monate unterwegs
- Autarkie ist MUSS, nicht nice-to-have
- Bereit für Sensor-Integration
- Hohe Zahlungsbereitschaft

### Sekundär: Wochenend-Vanlife
- Kürzere Trips
- Weniger technisch
- "Reicht mein Wasser fürs Wochenende?"

### Tertiär: Boot-Fahrer / Tiny House
- Ähnliche Probleme
- Andere Ressourcen (Schwarzwasser, etc.)

---

## 💰 Monetarisierung

### Free Tier
- Manuelles Tracking
- 1 Fahrzeug
- Basis-Karte
- Werbung

### Premium (7€/Monat | 70€/Jahr)
- Sensor-Integration (Bluetooth)
- Unbegrenzte Fahrzeuge
- Offline-Karten
- Wetter-Integration
- Keine Werbung

### Pro (15€/Monat | 150€/Jahr)
- Alles aus Premium
- API für Smart-Home Integration
- Historische Analysen
- Multi-User (Familie/Freunde)
- White-Label für Vermieter

### Hardware-Bundle
- Sensoren-Set (Wasser, Batterie) + 1 Jahr Premium
- Preis: 150-200€
- Marge: ~50%

---

## 🛠️ Technische Umsetzung

### App-Architektur

```
┌──────────────────────────────────────┐
│              Frontend                │
│   (React Native / Flutter)           │
├──────────────────────────────────────┤
│         Bluetooth Manager            │
│   (Sensor-Kommunikation)             │
├──────────────────────────────────────┤
│         Local Database               │
│   (SQLite - Offline-First)           │
├──────────────────────────────────────┤
│              Backend                 │
│   (Sync, POI-Daten, Wetter)          │
└──────────────────────────────────────┘
```

### Sensor-Integration

**Unterstützte Protokolle:**
- Victron VE.Direct (Batterie)
- Bluetooth LE (generische Sensoren)
- NMEA 2000 (Boot-Standard)
- WiFi (Truma, Dometic)

**Eigener Sensor (optional):**
- ESP32-basiert
- Ultraschall Wassersensor
- ~30€ Materialkosten
- Open-Source Hardware

### Offline-First

- App funktioniert KOMPLETT offline
- Sync wenn Internet verfügbar
- Karten vorher downloadbar
- POI-Daten lokal gecached

---

## 📱 MVP Features (8-12 Wochen)

### Phase 1: Basics (4 Wochen)
1. Fahrzeug-Setup (manuell)
2. Dashboard mit Füllständen
3. Manuelle Ein-/Ausgabe
4. Basis-Berechnung "Tage verbleibend"

### Phase 2: Karte (3 Wochen)
5. Versorgungsstellen auf Karte
6. Filter nach Ressourcen-Typ
7. Navigation zu Stellen
8. Offline-Karten

### Phase 3: Smart Features (3 Wochen)
9. Bluetooth Sensor-Integration
10. Lernender Verbrauch
11. Wetter-Integration
12. Push-Notifications ("Wasser wird knapp")

### Phase 4: Community (2 Wochen)
13. Stelle melden/bewerten
14. Sync zwischen Geräten
15. Teilen mit Reisepartnern

---

## ❓ Kritische Fragen

### 1. "Braucht man dafür Sensoren?"
**Nein.** Manuelles Tracking funktioniert auch. Sensoren sind Komfort, nicht Pflicht.

### 2. "Gibt's das nicht schon?"
**Teilweise.** 
- Victron App → Nur Batterie, nur Victron
- Truma App → Nur Heizung
- Diverse Tank-Apps → Nur manuell, keine Karte

**Niemand** hat alles kombiniert + Karte + Versorgungsstellen.

### 3. "Wie genau sind die Berechnungen?"
**Hängt vom Input ab.** Mit Sensoren: sehr genau. Ohne: Schätzung die besser wird.

### 4. "Hardware-Geschäft ist kompliziert"
**Stimmt.** Daher: Hardware optional, nicht required. Oder Partnerschaften mit Sensor-Herstellern.

### 5. "Zu nischig?"
**Ja, aber:** Nische = weniger Konkurrenz, höhere Zahlungsbereitschaft. Overlander zahlen 100k+ für Fahrzeuge, 70€/Jahr ist nichts.

---

## 📊 Marktpotenzial

### Overlander (Primär)

| Region | Anzahl | Conversion | Preis | Revenue |
|--------|--------|------------|-------|---------|
| DACH | 5.000 | 20% | 70€/Jahr | 70.000€ |
| Europa | 25.000 | 15% | 70€/Jahr | 262.500€ |
| Global | 100.000 | 10% | 70€/Jahr | 700.000€ |

### Vanlife/Wohnmobil (Sekundär)

| Region | Anzahl | Conversion | Preis | Revenue |
|--------|--------|------------|-------|---------|
| DACH | 500.000 | 2% | 70€/Jahr | 700.000€ |

### Hardware-Bundle

| Verkäufe/Jahr | Preis | Marge | Revenue |
|---------------|-------|-------|---------|
| 1.000 | 200€ | 50% | 100.000€ |

**Potenzial Jahr 3:** ~1.5 Mio € ARR

---

## 🆚 Vergleich mit Konzept 1 & 2

| Aspekt | Quietcamp | Big Rig Router | **DaysLeft** |
|--------|-----------|----------------|---------------------|
| **Problem** | Overtourism | Fahrzeug passt nicht | Ressourcen-Management |
| **Dringlichkeit** | Nice-to-have | Must-have | Must-have (Langzeit) |
| **Zielgruppe** | Alle Camper | Große Fahrzeuge | Autarke Overlander |
| **Marktgröße** | Groß | Mittel | Klein |
| **Konkurrenz** | Park4Night | CoPilot | Kaum |
| **Differenzierung** | Neu | Besser | Komplett neu |
| **Technisch** | Einfach | Mittel | Komplex |
| **MVP-Zeit** | 2-3 Wochen | 4-6 Wochen | 8-12 Wochen |
| **Hardware** | Nein | Nein | Optional |

---

## ✅ Pro DaysLeft
- **Kaum Konkurrenz** - Wirklich neues Produkt
- **Klarer Mehrwert** - "Nie wieder Unsicherheit"
- **Hardware-Potential** - Zusätzliche Revenue-Quelle
- **Loyale Zielgruppe** - Overlander sind Community
- **Erweiterbar** - Boot, Tiny House, Prepper

## ❌ Contra DaysLeft
- **Kleinste Zielgruppe** der 3 Konzepte
- **Technisch komplex** - Sensoren, Bluetooth, Offline
- **Längste MVP-Zeit** - 8-12 Wochen
- **Hardware-Risiko** - Wenn Sensor-Bundle gewünscht

---

## 🤔 Wann macht DaysLeft Sinn?

✅ Wenn du langfristig denkst (2-3 Jahre Horizont)
✅ Wenn du technische Herausforderungen magst
✅ Wenn du Overlander-Community gut kennst
✅ Wenn du potenziell Hardware verkaufen willst

❌ Wenn du schnell Ergebnisse willst
❌ Wenn du große Nutzerzahlen brauchst
❌ Wenn Hardware zu riskant ist

---

## 🚀 Nächste Schritte

1. [ ] Interviews mit 10 Langzeit-Overlanern
2. [ ] Sensor-Markt analysieren (Victron, etc.)
3. [ ] MVP ohne Sensoren als Web-App
4. [ ] Beta-Test mit manueller Eingabe
5. [ ] Sensor-Integration nach Feedback

---

*Erstellt: Februar 2026*  
*Status: Konzept*
