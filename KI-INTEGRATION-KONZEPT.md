# KI-Integration für TrailQuest Offgrid

## 🤖 KI/ML Einsatzmöglichkeiten

### 1. **LLM für Routen-Empfehlungen** (OpenAI, Claude, Gemini)

#### Use Cases:
- **Scenic Route Discovery**: "Finde die 3 schönsten Routen zwischen München und Pyrenäen"
- **POI-Empfehlungen**: "Welche Aussichtspunkte liegen auf meiner Route?"
- **Lokales Wissen**: "Beste versteckte Offroad-Tracks in den Pyrenäen"
- **Sehenswürdigkeiten-Integration**: "Historische Orte entlang Route"

#### Implementation:
```javascript
// Prompt für Route-Optimierung
const prompt = `
Du bist ein Offroad-Experte für ${region}.

Route: ${startCity} → ${endCity}
Fahrzeug: ${vehicleType}
Präferenzen: ${preferences}

Aufgabe:
1. Empfehle 3 alternative Routen mit Fokus auf:
   - Landschaftliche Schönheit
   - Offroad-Highlights
   - Aussichtspunkte
   - Sehenswürdigkeiten
2. Für jede Route: Beschreibung, Highlights, Schwierigkeit

Format: JSON mit lat/lon für Waypoints
`;

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }],
  response_format: { type: "json_object" }
});
```

#### Vorteile:
- ✅ Flexibel & intelligent
- ✅ Natürliche Sprache
- ✅ Kontext-Verständnis
- ❌ API-Kosten (ca. $0.01-0.03 pro Route)
- ❌ Langsamer (2-5 Sekunden)

---

### 2. **Computer Vision für Landschafts-Scoring** (Google Vision, AWS Rekognition)

#### Use Cases:
- **Scenic Score**: Analysiere Satellitenbilder entlang Route
- **Terrain Detection**: Erkenne Berge, Wälder, Seen
- **Road Quality**: Bewerte Straßenzustand aus Street View

#### Implementation:
```javascript
// Sample Route-Punkte und analysiere Umgebung
async function analyzeScenicScore(routeCoordinates) {
  const samplePoints = samplePoints(routeCoordinates, 20); // Alle 20km
  let totalScore = 0;
  
  for (const point of samplePoints) {
    // Hole Satellitenbild
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${point.lat},${point.lon}&zoom=15&size=640x640&maptype=satellite&key=${API_KEY}`;
    
    // Analysiere mit Vision API
    const [result] = await visionClient.labelDetection(imageUrl);
    
    // Score basierend auf Labels: mountain, forest, lake, scenic
    const scenicLabels = ['mountain', 'forest', 'lake', 'valley', 'scenic'];
    const score = result.labelAnnotations
      .filter(l => scenicLabels.includes(l.description.toLowerCase()))
      .reduce((sum, l) => sum + l.score, 0);
    
    totalScore += score;
  }
  
  return totalScore / samplePoints.length * 100;
}
```

#### Vorteile:
- ✅ Objektiv messbar
- ✅ Hohe Genauigkeit
- ❌ API-Kosten (ca. $1.50 per 1000 Bilder)
- ❌ Nur visuelle Features

---

### 3. **Embeddings für Ähnliche Routen** (OpenAI Embeddings)

#### Use Cases:
- **"Routen wie diese"**: Finde ähnliche Routen
- **User-Präferenzen lernen**: "Du magst bergige Offroad-Routen"
- **Community-Empfehlungen**: "User die diese Route mochten, mochten auch..."

#### Implementation:
```javascript
// Erstelle Route-Embedding
const routeDescription = `
Region: ${region}
Distanz: ${distance}km
Offroad: ${offroadPercent}%
Terrain: ${terrainTypes}
POIs: ${pois}
Schwierigkeit: ${difficulty}
`;

const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: routeDescription
});

// Speichere in Vector DB (Pinecone, Weaviate, pgvector)
await vectorDB.upsert({
  id: routeId,
  values: embedding.data[0].embedding,
  metadata: { region, distance, difficulty }
});

// Finde ähnliche Routen
const similar = await vectorDB.query({
  vector: userRouteEmbedding,
  topK: 5
});
```

#### Vorteile:
- ✅ Sehr günstig ($0.00002 per 1K tokens)
- ✅ Schnell
- ✅ Skalierbar
- ✅ Personalisierung möglich

---

### 4. **ML-Modell für Offroad-Track-Qualität** (Custom TensorFlow/PyTorch)

#### Use Cases:
- **Track-Bewertung**: Vorhersage von Track-Qualität aus OSM-Daten
- **Schwierigkeits-Prediction**: Basierend auf Steigung, Surface, etc.
- **Fahrzeug-Eignung**: "Ist Track für dein Fahrzeug geeignet?"

#### Training Data:
- OSM Tags: surface, tracktype, smoothness, width
- User-Bewertungen aus Community
- Fahrzeug-Specs

#### Features:
```python
features = [
  'surface_type',      # paved, unpaved, gravel, sand
  'smoothness',        # excellent, good, intermediate, bad
  'width',             # meters
  'grade',             # Steigung in %
  'altitude',          # Höhe ü.M.
  'vehicle_clearance', # Bodenfreiheit
  'vehicle_4wd',       # 4x4 ja/nein
]

# Training
model = RandomForestClassifier()
model.fit(X_train, y_train)  # y = track_quality (1-5)

# Prediction
quality = model.predict(track_features)
```

#### Vorteile:
- ✅ Kostenlos nach Training
- ✅ Sehr schnell
- ✅ Offline möglich
- ❌ Aufwändiges Training
- ❌ Braucht Trainings-Daten

---

### 5. **RAG für Lokales Wissen** (Retrieval Augmented Generation)

#### Use Cases:
- **Community-Wissen**: "Beste Wildcamps in den Pyrenäen?"
- **Lokale Tipps**: "Wo gibt es Wasser/Entsorgung?"
- **Erfahrungsberichte**: "Welche Tracks sind im Winter befahrbar?"

#### Datenquellen:
- iOverlander Reviews
- Reddit/Forum-Posts (r/overlanding, expedition-portal.com)
- YouTube-Video-Transkripte (Offroad-Kanäle)
- User-Generated Content aus App

#### Implementation:
```javascript
// 1. Scrape & Index Community-Content
const documents = await scrapeForumPosts('pyrenees offroad');
const chunks = chunkDocuments(documents, 500); // 500 chars

// 2. Erstelle Embeddings
const embeddings = await Promise.all(
  chunks.map(chunk => openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunk
  }))
);

// 3. Speichere in Vector DB
await vectorDB.upsert(embeddings);

// 4. Query mit RAG
const userQuestion = "Beste Offroad-Tracks Pyrenäen für Anfänger?";
const relevantDocs = await vectorDB.query(userQuestion, topK: 5);

const prompt = `
Kontext: ${relevantDocs.join('\n\n')}

Frage: ${userQuestion}

Antworte basierend auf dem Kontext.
`;

const answer = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }]
});
```

#### Vorteile:
- ✅ Nutzt echtes Community-Wissen
- ✅ Immer aktuell (wenn regelmäßig gescraped)
- ✅ Sehr relevante Empfehlungen
- ❌ Scraping aufwändig
- ❌ Rechtliche Grauzone

---

## 🎯 Empfohlene Implementierung (MVP)

### **Phase 1: LLM Route-Empfehlungen** (2-3h)

```javascript
// backend/utils/ai-route-recommender.js

export async function getScenicRouteRecommendations(start, end, preferences) {
  const prompt = `Du bist ein Offroad-Experte.

Start: ${start.name} (${start.lat}, ${start.lon})
Ziel: ${end.name} (${end.lat}, ${end.lon})

Präferenzen:
- Offroad-Anteil: ${preferences.offroadWeight * 100}%
- Scenic-Präferenz: ${preferences.scenicWeight * 100}%
- Fahrzeug: ${preferences.vehicle}

Aufgabe: Empfehle die 3 schönsten/interessantesten Routen mit:

1. **Alpine Route**: Durch Berge, maximale Aussichten
2. **Scenic Backroads**: Landstraßen durch malerische Dörfer  
3. **Offroad Adventure**: Maximale Offroad-Strecken

Für jede Route:
- Name & Beschreibung
- Highlights (Aussichtspunkte, Sehenswürdigkeiten, Offroad-Tracks)
- 5-10 wichtige Waypoints mit lat/lon
- Geschätzte Distanz & Dauer
- Schwierigkeit (easy/medium/hard)

Antworte in JSON:
{
  "routes": [
    {
      "name": "Alpine Route",
      "description": "...",
      "highlights": ["Col du Tourmalet", "Cirque de Gavarnie"],
      "waypoints": [{"lat": 48.1, "lon": 11.5, "name": "München"}, ...],
      "estimatedDistance": 1200,
      "estimatedDuration": 15,
      "difficulty": "medium",
      "scenicScore": 95,
      "offroadPercent": 30
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Günstiger als gpt-4
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**API-Kosten**: ~$0.005 pro Route (sehr günstig!)

---

### **Phase 2: Embeddings für Route-Similarity** (2-3h)

```javascript
// Finde ähnliche Routen
export async function findSimilarRoutes(routeId) {
  const route = await db.getRoute(routeId);
  
  const description = `
    Region: ${route.region}
    Distanz: ${route.distance}km
    Offroad: ${route.offroadPercent}%
    Terrain: ${route.terrainTypes}
    Highlights: ${route.highlights.join(', ')}
  `;
  
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: description
  });
  
  // Query PostgreSQL mit pgvector
  const similar = await db.query(`
    SELECT * FROM routes
    ORDER BY embedding <-> $1
    LIMIT 5
  `, [embedding.data[0].embedding]);
  
  return similar;
}
```

---

### **Phase 3: Community POI-Empfehlungen** (3-4h)

```javascript
// Nutze GPT für POI-Discovery
export async function discoverPOIsAlongRoute(route) {
  const prompt = `
    Route: ${route.start} → ${route.end}
    
    Finde entlang dieser Route:
    1. Spektakuläre Aussichtspunkte
    2. Sehenswürdigkeiten (Natur & Kultur)
    3. Bekannte Offroad-Tracks (Name, Schwierigkeit)
    4. Fotospots
    5. Lokale Geheimtipps
    
    JSON-Format:
    {
      "viewpoints": [{"name": "", "lat": 0, "lon": 0, "description": ""}],
      "attractions": [...],
      "offroadTracks": [...],
      "photoSpots": [...],
      "localTips": [...]
    }
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

---

## 💰 Kosten-Abschätzung

### OpenAI API:
- **GPT-4o-mini**: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- **Embeddings**: $0.020 / 1M tokens

### Beispiel-Kosten pro Route-Berechnung:
- Routen-Empfehlung: ~1500 tokens → **$0.002**
- 3 POI-Discoveries: ~3000 tokens → **$0.005**
- Embeddings: ~200 tokens → **$0.000004**

**Total: ~$0.007 pro Trip-Planung** = extrem günstig!

Bei 1000 Nutzern/Monat mit 2 Trips/Monat: **$14/Monat**

---

## 🚀 Schnellstart-Implementation

**Ich kann jetzt implementieren:**

1. ✅ **LLM Route-Empfehlungen** (3 schöne Alternative-Routen)
2. ✅ **POI-Discovery** (Aussichtspunkte, Sehenswürdigkeiten)
3. ✅ **Offroad-Track-Empfehlungen** (bekannte/beliebte Tracks)

**Benötigt:**
- OpenAI API Key (du musst dir einen holen)
- ~2-3 Stunden Implementation

Soll ich starten?
