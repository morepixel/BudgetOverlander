// AI Route Recommender - OpenAI Integration
import OpenAI from 'openai';
import { calculateOffroadPercentage } from './offroad-finder.js';
import { calculateScenicScore, findScenicAlongRoute } from './scenic-finder.js';
import { calculateGermanyOffroadPercentage, isInGermany as isInGermanyOffroad } from './germany-offroad-finder.js';
import { calculateGermanyScenicScore, findGermanyScenicAlongRoute, isInGermany as isInGermanyScenic } from './germany-scenic-finder.js';

let openai = null;

// Initialize OpenAI client
function initOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY nicht gesetzt - AI-Features deaktiviert');
    return false;
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return true;
}

/**
 * Hole AI-generierte Routen-Empfehlungen
 */
export async function getAIRouteRecommendations(start, end, preferences = {}) {
  if (!initOpenAI()) {
    return {
      enabled: false,
      message: 'AI-Features nicht verfügbar - bitte OPENAI_API_KEY setzen'
    };
  }

  try {
    // Ermittle Land aus Startpunkt wenn nötig
    if (preferences.stayInCountry) {
      start.country = await getCountryFromCoords(start.lat, start.lon);
    }
    
    const prompt = preferences.discoveryMode 
      ? buildDiscoveryPrompt(start, preferences)
      : buildRoutePrompt(start, end, preferences);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Günstiger als gpt-4
      messages: [
        {
          role: "system",
          content: "Du bist ein Experte für Offroad-Reisen und Scenic Routes in Europa. Du kennst die schönsten Strecken, versteckten Aussichtspunkte und besten Offroad-Tracks."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Berechne realistische Werte basierend auf tatsächlichen Daten
    if (result.routes && result.routes.length > 0) {
      console.log('🔍 Berechne realistische Offroad- und Scenic-Werte...');
      
      for (const route of result.routes) {
        if (route.waypoints && route.waypoints.length > 0) {
          // Check if route is in Germany
          const firstWp = route.waypoints[0];
          const inGermany = isInGermanyOffroad(firstWp.lat, firstWp.lon);
          
          // Offroad-Prozente (schnell aus Deutschland-DB oder langsam aus Overpass)
          const realisticOffroad = inGermany 
            ? await calculateGermanyOffroadPercentage(route.waypoints)
            : await calculateOffroadPercentage(route.waypoints);
          route.offroadPercent = realisticOffroad;
          
          // Scenic-Score (schnell aus Deutschland-DB oder langsam aus Overpass)
          const realisticScenic = inGermany
            ? await calculateGermanyScenicScore(route.waypoints)
            : await calculateScenicScore(route.waypoints);
          route.scenicScore = realisticScenic;
          
          // Scenic-Punkte entlang Route
          const scenicPoints = inGermany
            ? await findGermanyScenicAlongRoute(route.waypoints, 10)
            : await findScenicAlongRoute(route.waypoints, 10);
          route.scenicPoints = scenicPoints;
          
          console.log(`📊 ${route.name}: Offroad=${realisticOffroad}%, Scenic=${realisticScenic}/100 ${inGermany ? '(Germany DB ⚡)' : '(Overpass API 🐌)'}`);
        }
      }
    }
    
    return {
      enabled: true,
      routes: result.routes || [],
      usage: response.usage
    };
    
  } catch (error) {
    console.error('AI Route Recommender error:', error);
    return {
      enabled: false,
      error: error.message
    };
  }
}

/**
 * Entdecke POIs entlang Route
 */
export async function discoverPOIsAlongRoute(route, preferences = {}) {
  if (!initOpenAI()) {
    return { enabled: false };
  }

  try {
    const prompt = `
Analysiere folgende Route und finde interessante Punkte:

Start: ${route.start.name} (${route.start.lat}, ${route.start.lon})
Ziel: ${route.end.name} (${route.end.lat}, ${route.end.lon})
${route.waypoints ? `Via: ${route.waypoints.map(w => w.name).join(', ')}` : ''}

Finde entlang dieser Route:
1. **Spektakuläre Aussichtspunkte** (Berge, Panoramen, Fotospots)
2. **Sehenswürdigkeiten** (Natur & Kultur)
3. **Bekannte Offroad-Tracks** (Name, Schwierigkeit, Typ)
4. **Lokale Geheimtipps** (versteckte Orte, die nicht jeder kennt)
5. **Empfohlene Stops** (Essen, Pause, Tanken)

Wichtig: Gib realistische GPS-Koordinaten an, die tatsächlich auf/nahe der Route liegen!

Antworte in folgendem JSON-Format:
{
  "viewpoints": [
    {"name": "Name", "lat": 0.0, "lon": 0.0, "description": "...", "elevation": 0}
  ],
  "attractions": [
    {"name": "Name", "lat": 0.0, "lon": 0.0, "description": "...", "type": "nature|culture"}
  ],
  "offroadTracks": [
    {"name": "Name", "lat": 0.0, "lon": 0.0, "description": "...", "difficulty": "easy|medium|hard"}
  ],
  "localTips": [
    {"name": "Name", "lat": 0.0, "lon": 0.0, "description": "...", "type": "food|fuel|camping"}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 1500
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      enabled: true,
      ...result,
      usage: response.usage
    };
    
  } catch (error) {
    console.error('POI Discovery error:', error);
    return { enabled: false, error: error.message };
  }
}

/**
 * Build Prompt für Discovery Mode (ohne festes Ziel)
 */
function buildDiscoveryPrompt(start, preferences) {
  const {
    tripDays = 7,
    maxTotalKm = 2000,
    roundTrip = true,
    stayInCountry = false,
    offroadWeight = 0.5,
    scenicWeight = 0.3,
    vehicle = 'Overland Truck'
  } = preferences;

  return `
Du bist ein Offroad-Reise-Experte und planst epische Abenteuer-Touren in Europa.

**Ausgangspunkt**: ${start.name} (${start.lat}, ${start.lon})

**Trip-Parameter**:
- Dauer: ${tripDays} Tage
- Max. Gesamt-Distanz: ${maxTotalKm} km
- Tour-Typ: ${roundTrip ? 'Rundtour (zurück zum Start)' : 'Einweg-Tour'}
${stayInCountry && start.country ? `- WICHTIG: Bleibe innerhalb von ${start.country} - überschreite keine Landesgrenzen!` : ''}
- Offroad-Wunsch: ${Math.round(offroadWeight * 100)}%
- Scenic-Wunsch: ${Math.round(scenicWeight * 100)}%
- Fahrzeug: ${vehicle}

**Aufgabe**: Empfehle 3 unterschiedliche Abenteuer-Routen die vom Startpunkt wegführen:

1. **Alpine Adventure**
   - Durch Bergregionen, Pässe, alpine Landschaften
   - Für: Bergliebhaber & Fotografen

2. **Coastal Explorer**
   - Entlang Küsten, Strände, maritime Landschaften
   - Für: Meer-Fans & Entspannung

3. **Offroad Expedition**
   - Maximale Offroad-Strecken, abgelegene Gegenden, Schotterwege
   - Für: Hardcore-Offroader

Für **jede Route**:
- Kreativer Name (z.B. "Pyrenäen-Durchquerung", "Atlantik-Odyssee")
- Beschreibung (2-3 Sätze) - was macht sie besonders?
- 5-10 wichtige Waypoints mit GPS-Koordinaten
- Top Highlights (Orte, Aussichtspunkte, Tracks)
- Geschätzte Distanz in km (sollte <= ${maxTotalKm} km sein)
- Geschätzte Dauer in Tagen (sollte ~${tripDays} Tage sein)
- Schwierigkeit (easy/medium/hard)

**SEHR WICHTIG**:
- Der **erste Waypoint** MUSS **EXAKT** der Startpunkt sein: ${start.name} (${start.lat}, ${start.lon})
${roundTrip ? `- Der **letzte Waypoint** MUSS **EXAKT** zurück zum Start sein: ${start.name} (${start.lat}, ${start.lon})` : '- Der letzte Waypoint ist das finale Ziel der Route'}
- Waypoints dazwischen sollten logisch auf der Route liegen
- Jede Route sollte in eine andere Richtung/Region führen
- Berücksichtige realistische Entfernungen für ${tripDays} Tage

Antworte in folgendem JSON-Format:
{
  "routes": [
    {
      "id": "alpine_adventure",
      "name": "Kreativer Name",
      "description": "Beschreibung...",
      "type": "alpine|coastal|offroad",
      "highlights": ["Highlight 1", "Highlight 2"],
      "waypoints": [
        {"name": "${start.name}", "lat": ${start.lat}, "lon": ${start.lon}, "description": "Startpunkt"},
        {"name": "Waypoint 2", "lat": 0.0, "lon": 0.0, "description": "..."},
        ...
        ${roundTrip ? `{"name": "${start.name}", "lat": ${start.lat}, "lon": ${start.lon}, "description": "Zurück am Start"}` : '{"name": "Zielpunkt", "lat": 0.0, "lon": 0.0, "description": "Ende der Tour"}'}
      ],
      "estimatedDistance": 1800,
      "estimatedDuration": ${tripDays},
      "difficulty": "medium",
      "bestFor": "Für wen ist diese Route ideal?"
    }
  ]
}

**WICHTIG:** 
- Gib KEINE Offroad- oder Scenic-Prozente an - diese werden automatisch aus echten Daten berechnet
- Fokussiere dich auf realistische Waypoints und gute Routenführung`;
}

/**
 * Build Prompt für Routen-Empfehlungen
 */
function buildRoutePrompt(start, end, preferences) {
  const {
    offroadWeight = 0.5,
    scenicWeight = 0.3,
    vehicle = 'Overland Truck'
  } = preferences;

  return `
Plane eine epische Overlanding-Route von ${start.name} nach ${end.name}.

**Start**: ${start.name} (${start.lat}, ${start.lon})
**Ziel**: ${end.name} (${end.lat}, ${end.lon})

**Präferenzen**:
- Offroad-Anteil: ${Math.round(offroadWeight * 100)}% (${offroadWeight > 0.7 ? 'sehr wichtig' : offroadWeight > 0.4 ? 'wichtig' : 'optional'})
- Scenic Routes: ${Math.round(scenicWeight * 100)}% (${scenicWeight > 0.7 ? 'maximale Schönheit' : scenicWeight > 0.4 ? 'schöne Strecken' : 'egal'})
- Fahrzeug: ${vehicle}

**Aufgabe**: Empfehle 3 unterschiedliche Routen-Varianten:

1. **Alpine/Mountain Route** 
   - Fokus: Bergpässe, höchste Aussichtspunkte, alpine Landschaften
   - Für: Landschafts-Liebhaber & Fotografen
   
2. **Scenic Backroads**
   - Fokus: Malerische Landstraßen, schöne Dörfer, kulturelle Highlights
   - Für: Genießer & Kultur-Interessierte
   
3. **Offroad Adventure**
   - Fokus: Maximale Offroad-Strecken, Schotterwege, Forststraßen, Tracks
   - Für: Offroad-Enthusiasten

Für **jede Route**:
- Kreativer Name
- Kurze Beschreibung (2-3 Sätze)
- 5-10 wichtige Waypoints mit GPS-Koordinaten (lat/lon)
- Top Highlights (Aussichtspunkte, Sehenswürdigkeiten, Offroad-Tracks)
- Geschätzte Distanz in km
- Geschätzte Dauer in Stunden
- Schwierigkeit (easy/medium/hard)

**SEHR WICHTIG**: 
- Der **erste Waypoint** MUSS **EXAKT** der Startpunkt sein: ${start.name} (${start.lat}, ${start.lon})
- Der **letzte Waypoint** MUSS **EXAKT** der Zielpunkt sein: ${end.name} (${end.lat}, ${end.lon})
- Alle Waypoints dazwischen sollten logisch zwischen Start und Ziel liegen
- Realistische GPS-Koordinaten verwenden
- Highlights sollten tatsächlich existieren

Antworte in folgendem JSON-Format:
{
  "routes": [
    {
      "id": "alpine_route",
      "name": "Kreativer Name",
      "description": "Beschreibung...",
      "type": "alpine|scenic|offroad",
      "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
      "waypoints": [
        {"name": "${start.name}", "lat": ${start.lat}, "lon": ${start.lon}, "description": "Startpunkt"},
        {"name": "Waypoint 2", "lat": 0.0, "lon": 0.0, "description": "Zwischenstopp"},
        {"name": "Waypoint 3", "lat": 0.0, "lon": 0.0, "description": "Zwischenstopp"},
        ...
        {"name": "${end.name}", "lat": ${end.lat}, "lon": ${end.lon}, "description": "Zielpunkt"}
      ],
      "estimatedDistance": 1200,
      "estimatedDuration": 0,
      "difficulty": "medium",
      "bestFor": "Für wen ist diese Route ideal?"
    }
  ]
}

**WICHTIG:**
- Gib KEINE Offroad- oder Scenic-Prozente an - diese werden automatisch aus echten Daten berechnet
- Fokussiere dich auf realistische Waypoints und gute Routenführung`;
}

/**
 * Ermittle Land aus Koordinaten (Reverse Geocoding)
 */
async function getCountryFromCoords(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=3`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Budget-Overlander-App'
      }
    });
    const data = await response.json();
    return data.address?.country || null;
  } catch (error) {
    console.error('Country detection error:', error);
    return null;
  }
}

/**
 * Hole AI-Beschreibung für Route
 */
export async function getRouteNarrative(route) {
  if (!initOpenAI()) {
    return null;
  }

  try {
    const prompt = `
Schreibe eine inspirierende, emotionale Beschreibung für diese Overlanding-Route:

Route: ${route.name}
Start: ${route.start}
Ziel: ${route.end}
Distanz: ${route.distance}km
Highlights: ${route.highlights?.join(', ') || 'N/A'}

Schreibe:
1. Eine packende Einleitung (1-2 Sätze)
2. Was macht diese Route besonders? (2-3 Sätze)
3. Für wen ist sie geeignet? (1 Satz)

Stil: Abenteuerlich, inspirierend, aber nicht übertrieben.
Länge: Max. 150 Wörter.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 300
    });

    return response.choices[0].message.content.trim();
    
  } catch (error) {
    console.error('Route narrative error:', error);
    return null;
  }
}
