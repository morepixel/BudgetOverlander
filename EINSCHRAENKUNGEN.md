# Einschränkungen der aktuellen Overpass-Lösung

## ⚠️ Wichtige Erkenntnisse

### Problem 1: Isolierte Forstwege
**Beispiel:** [Eselbackenweg (OSM 43126285)](https://www.openstreetmap.org/way/43126285)

**Was ist das Problem?**
- Der Weg liegt mitten im Wald
- Keine direkte Anbindung an befahrbare Hauptstraßen sichtbar
- Möglicherweise nur über andere Forstwege erreichbar
- Unklar, ob die Zufahrtswege ebenfalls befahrbar sind

**Warum findet die Query solche Wege?**
Die Overpass-Query sucht nur nach einzelnen Wegen mit bestimmten Eigenschaften, aber prüft NICHT:
- ❌ Ob der Weg von einer öffentlichen Straße aus erreichbar ist
- ❌ Ob die Zufahrtswege ebenfalls für das Fahrzeug geeignet sind
- ❌ Ob es eine durchgehende Route gibt

### Problem 2: Unsichere Fahrzeug-Eignung

**Was wir NICHT wissen:**
- Tatsächliche Wegbreite (oft nicht in OSM erfasst)
- Aktuelle Wegbeschaffenheit (Daten können veraltet sein)
- Hindernisse (umgestürzte Bäume, Schranken, Gräben)
- Steigungen und Gefälle
- Kurvenradien für große Fahrzeuge

**Was die Tags bedeuten:**
- `motor_vehicle=forestry` → Nur für Forstfahrzeuge
- `tracktype=grade2` → "Überwiegend befestigt" (aber nicht immer!)
- `surface=compacted` → Verdichteter Boden (kann bei Regen matschig werden)

## 🔍 Was müsste verbessert werden?

### 1. Erreichbarkeits-Analyse
```
Für jeden gefundenen Weg:
1. Prüfe Anbindung an öffentliche Straßen
2. Berechne Route vom Startpunkt zum Weg
3. Prüfe alle Zwischenwege auf Befahrbarkeit
4. Markiere isolierte Wege als "nicht erreichbar"
```

### 2. Routing-Integration
Statt einzelne Wege zu finden, sollte die App:
- Komplette Routen berechnen (Start → Offroad → Ziel)
- Nur Wege anzeigen, die tatsächlich erreichbar sind
- Alternative Routen vorschlagen

### 3. Höhenprofil
- SRTM-Daten integrieren
- Steigungen berechnen
- Zu steile Abschnitte markieren (>15% für schwere Fahrzeuge)

### 4. Community-Daten
- User-Bewertungen ("Bin ich mit FUSO gefahren")
- Aktuelle Fotos
- Warnungen (Schranken, Sperrungen, etc.)

## 💡 Empfehlungen für MVP

### Kurzfristig (jetzt machbar):
1. **Disclaimer hinzufügen:**
   > "Diese Wege sind potenzielle Offroad-Strecken. Prüfe vor Ort die Befahrbarkeit und Erreichbarkeit!"

2. **Zusätzliche Infos anzeigen:**
   - `motor_vehicle` Tag prominent anzeigen
   - Warnung bei `forestry` (nur für Forstfahrzeuge)
   - Link zu OSM für manuelle Prüfung

3. **Filter verschärfen:**
   - Nur Wege mit explizitem `motor_vehicle=yes`
   - Nur `tracktype=grade1` oder `grade2`
   - Mindestbreite erforderlich (wenn erfasst)

### Mittelfristig (mit mehr Aufwand):
1. **Routing-Engine integrieren:**
   - OSRM oder GraphHopper
   - Berechne tatsächliche Routen
   - Prüfe Erreichbarkeit

2. **Höhenprofil:**
   - SRTM-Daten laden
   - Steigungen berechnen
   - Schwierigkeits-Score anpassen

3. **Manuelle Kuratierung:**
   - Community-verifizierte Routen
   - "Geprüft mit FUSO"-Badge
   - Bewertungssystem

## 🎯 Realistische Einschätzung

**Was die aktuelle Lösung kann:**
✅ Potenzielle Offroad-Wege finden
✅ Nach Oberfläche/Tracktype filtern
✅ Fahrzeug-Constraints prüfen (Breite, Gewicht, Höhe)
✅ Zu kurze Wege ausfiltern

**Was die aktuelle Lösung NICHT kann:**
❌ Erreichbarkeit garantieren
❌ Aktuelle Wegbeschaffenheit prüfen
❌ Komplette Routen berechnen
❌ Steigungen berücksichtigen
❌ Hindernisse erkennen

## 📝 Fazit

Die Overpass-API ist ein **guter Ausgangspunkt**, aber:

1. **Nicht alle gefundenen Wege sind tatsächlich befahrbar**
2. **Nicht alle gefundenen Wege sind erreichbar**
3. **Die Daten müssen vor Ort verifiziert werden**

**Für ein MVP:**
- Nutze die Daten als "Inspiration" für Offroad-Touren
- Zeige deutliche Warnungen an
- Erlaube User-Feedback ("Bin ich gefahren" / "Nicht befahrbar")
- Integriere später eine Routing-Engine für echte Routenplanung

**Für eine Production-App:**
- Routing-Engine zwingend erforderlich
- Höhenprofil-Analyse notwendig
- Community-Verifizierung wichtig
- Regelmäßige Daten-Updates
