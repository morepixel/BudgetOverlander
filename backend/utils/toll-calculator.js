// Maut-Berechnung für europäische Länder
// Basis-Tabellen für häufige Overlanding-Routen

// Maut-Systeme pro Land
const TOLL_SYSTEMS = {
  // Deutschland - keine Maut für PKW/Wohnmobile
  DE: {
    name: 'Deutschland',
    type: 'none',
    vehicleTypes: {
      car: 0,
      van: 0,
      truck_under_7_5t: 0,
      truck_over_7_5t: 'lkw-maut' // LKW-Maut ab 7.5t
    }
  },
  
  // Frankreich - Autoroutes (Mautstraßen)
  FR: {
    name: 'Frankreich',
    type: 'distance',
    avgCostPerKm: {
      car: 0.10,        // ca. 10 Cent/km
      van: 0.12,        // ca. 12 Cent/km
      truck_under_7_5t: 0.15,
      truck_over_7_5t: 0.20
    },
    notes: 'Autoroutes sind vermeidbar, Nationalstraßen kostenfrei'
  },
  
  // Spanien - Autopistas (teilweise Maut)
  ES: {
    name: 'Spanien',
    type: 'distance',
    avgCostPerKm: {
      car: 0.08,
      van: 0.10,
      truck_under_7_5t: 0.12,
      truck_over_7_5t: 0.15
    },
    notes: 'Viele Autobahnen kostenfrei, nur Autopistas (AP-XX) mautpflichtig'
  },
  
  // Italien - Autostrade
  IT: {
    name: 'Italien',
    type: 'distance',
    avgCostPerKm: {
      car: 0.07,
      van: 0.09,
      truck_under_7_5t: 0.12,
      truck_over_7_5t: 0.18
    },
    notes: 'Fast alle Autobahnen mautpflichtig'
  },
  
  // Schweiz - Vignette
  CH: {
    name: 'Schweiz',
    type: 'vignette',
    cost: {
      car: 40,          // Jahresvignette
      van: 40,
      truck_under_7_5t: 40,
      truck_over_7_5t: 'lsva' // Leistungsabhängige Schwerverkehrsabgabe
    },
    validity: 'year',
    notes: 'Jahresvignette für Autobahnen, gültig 14 Monate'
  },
  
  // Österreich - Vignette + Streckenmaut
  AT: {
    name: 'Österreich',
    type: 'vignette',
    cost: {
      car: 96.40,       // Jahresvignette 2024
      van: 96.40,
      truck_under_7_5t: 96.40,
      truck_over_7_5t: 'go-maut'
    },
    validity: 'year',
    specialTolls: [
      { name: 'Brenner', cost: 11.50 },
      { name: 'Tauern', cost: 13.00 },
      { name: 'Felbertauern', cost: 13.00 }
    ],
    notes: 'Vignette + Sondermaut für bestimmte Strecken'
  },
  
  // Norwegen - Bompengar (City-Maut + Brücken/Tunnel)
  NO: {
    name: 'Norwegen',
    type: 'mixed',
    avgCostPerDay: {
      car: 15,
      van: 20,
      truck_under_7_5t: 30,
      truck_over_7_5t: 50
    },
    notes: 'Automatische Erfassung, Rechnung per Post. Viele Tunnel/Brücken mautpflichtig'
  },
  
  // Portugal - Via Verde
  PT: {
    name: 'Portugal',
    type: 'distance',
    avgCostPerKm: {
      car: 0.06,
      van: 0.08,
      truck_under_7_5t: 0.10,
      truck_over_7_5t: 0.12
    },
    notes: 'Elektronische Maut, teilweise vermeidbar'
  }
};

// Berechne Maut für Route
export function calculateToll(route, vehicleWeight = 7.5) {
  const vehicleType = getVehicleType(vehicleWeight);
  let totalCost = 0;
  const breakdown = {};
  
  // Schätze Länder-Anteile basierend auf Route
  const countries = estimateCountries(route);
  
  countries.forEach(({ country, distanceKm }) => {
    const tollSystem = TOLL_SYSTEMS[country];
    if (!tollSystem) return;
    
    let cost = 0;
    
    if (tollSystem.type === 'distance') {
      const costPerKm = tollSystem.avgCostPerKm[vehicleType] || 0;
      cost = distanceKm * costPerKm;
    } else if (tollSystem.type === 'vignette') {
      cost = tollSystem.cost[vehicleType] || 0;
    } else if (tollSystem.type === 'mixed') {
      const days = Math.ceil(distanceKm / 300); // ca. 300km/Tag
      cost = (tollSystem.avgCostPerDay[vehicleType] || 0) * days;
    }
    
    if (cost > 0) {
      breakdown[country] = {
        name: tollSystem.name,
        distance: distanceKm,
        cost: cost,
        notes: tollSystem.notes
      };
      totalCost += cost;
    }
  });
  
  return {
    total: totalCost,
    breakdown: breakdown,
    avoidable: isAvoidable(countries)
  };
}

// Bestimme Fahrzeug-Typ
function getVehicleType(weight) {
  if (weight < 3.5) return 'car';
  if (weight < 7.5) return 'van';
  if (weight <= 7.5) return 'truck_under_7_5t';
  return 'truck_over_7_5t';
}

// Schätze Länder-Anteile (vereinfacht)
function estimateCountries(route) {
  // Vereinfachte Logik basierend auf Region
  const region = route.region || '';
  
  if (region.includes('pyrenees')) {
    return [
      { country: 'FR', distanceKm: route.onroadKm * 0.5 },
      { country: 'ES', distanceKm: route.onroadKm * 0.5 }
    ];
  } else if (region.includes('sierra_nevada')) {
    return [
      { country: 'ES', distanceKm: route.onroadKm }
    ];
  } else if (region.includes('alps')) {
    return [
      { country: 'FR', distanceKm: route.onroadKm * 0.4 },
      { country: 'IT', distanceKm: route.onroadKm * 0.4 },
      { country: 'CH', distanceKm: route.onroadKm * 0.2 }
    ];
  } else if (region.includes('norway')) {
    return [
      { country: 'NO', distanceKm: route.onroadKm }
    ];
  }
  
  return [];
}

// Prüfe ob Maut vermeidbar
function isAvoidable(countries) {
  return countries.some(c => {
    const system = TOLL_SYSTEMS[c.country];
    return system && (system.type === 'distance' || system.notes?.includes('vermeidbar'));
  });
}

// Berechne Maut-freie Alternative (Schätzung)
export function calculateTollFreeAlternative(route) {
  const toll = calculateToll(route);
  
  if (!toll.avoidable) {
    return null; // Keine mautfreie Alternative
  }
  
  // Schätze längere Strecke ohne Autobahn
  const extraDistance = route.onroadKm * 0.3; // ca. 30% länger
  const extraTime = extraDistance / 60; // ca. 60 km/h auf Landstraßen
  
  return {
    distanceKm: route.onroadKm + extraDistance,
    extraTime: extraTime,
    tollSaved: toll.total,
    recommendation: toll.total > 50 ? 'Maut vermeiden lohnt sich' : 'Maut ist akzeptabel'
  };
}

// Maut-Info für Land
export function getTollInfo(countryCode) {
  return TOLL_SYSTEMS[countryCode] || null;
}
