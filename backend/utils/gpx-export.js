// GPX Export Utility
// Konvertiert GeoJSON-Routen in GPX-Format

export function generateGPX(routeData, metadata = {}) {
  const { name = 'Budget Overlander Route', description = '', author = 'Budget Overlander' } = metadata;
  
  const timestamp = new Date().toISOString();
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${author}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${timestamp}</time>
  </metadata>
`;

  // Waypoints (Cluster-Punkte)
  if (routeData.geojson && routeData.geojson.features) {
    routeData.geojson.features.forEach((feature, idx) => {
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};
        
        gpx += `  <wpt lat="${lat}" lon="${lon}">
    <name>${escapeXml(props.name || `Waypoint ${idx + 1}`)}</name>
    <desc>${escapeXml(props.description || '')}</desc>
    <type>waypoint</type>
  </wpt>
`;
      }
    });
  }

  // Track (Route)
  gpx += `  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
`;

  // Track-Segmente
  if (routeData.geojson && routeData.geojson.features) {
    routeData.geojson.features.forEach(feature => {
      if (feature.geometry.type === 'LineString') {
        gpx += `    <trkseg>
`;
        feature.geometry.coordinates.forEach(coord => {
          const [lon, lat] = coord;
          gpx += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>
`;
        });
        gpx += `    </trkseg>
`;
      }
    });
  }

  gpx += `  </trk>
</gpx>`;

  return gpx;
}

// Einfache GPX-Generierung aus Cluster-Liste
export function generateSimpleGPX(clusters, metadata = {}) {
  const { name = 'Budget Overlander Route', description = '' } = metadata;
  const timestamp = new Date().toISOString();
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Budget Overlander" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description)}</desc>
    <time>${timestamp}</time>
  </metadata>
`;

  // Waypoints für jeden Cluster
  clusters.forEach((cluster, idx) => {
    gpx += `  <wpt lat="${cluster.center.lat}" lon="${cluster.center.lon}">
    <name>${escapeXml(cluster.id || `Cluster ${idx + 1}`)}</name>
    <desc>Tracks: ${cluster.trackCount}, Offroad: ${cluster.totalLength.toFixed(1)}km, Difficulty: ${cluster.avgDifficulty}/100</desc>
    <type>waypoint</type>
  </wpt>
`;
  });

  // Track mit Verbindungen zwischen Clustern
  gpx += `  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
`;
  
  clusters.forEach(cluster => {
    gpx += `      <trkpt lat="${cluster.center.lat}" lon="${cluster.center.lon}"></trkpt>
`;
  });
  
  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

// XML-Escape-Funktion
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
