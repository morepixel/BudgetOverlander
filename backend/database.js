// JSON-basierte Datenbank (für MVP ohne native Dependencies)
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_FILE = join(__dirname, 'database.json');

// Initialisiere Datenbank
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      saved_routes: [],
      vehicles: [],
      _nextUserId: 1,
      _nextRouteId: 1,
      _nextVehicleId: 1
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

// Lade Datenbank
function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Speichere Datenbank
function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

initDB();

const db = {
  prepare: (query) => {
    return {
      get: (...params) => {
        const data = loadDB();
        
        if (query.includes('SELECT * FROM vehicles WHERE id')) {
          return data.vehicles.find(v => v.id === parseInt(params[0]) && v.user_id === parseInt(params[1]));
        }
        if (query.includes('SELECT * FROM saved_routes WHERE id')) {
          return data.saved_routes.find(r => r.id === parseInt(params[0]) && r.user_id === parseInt(params[1]));
        }
        if (query.includes('SELECT * FROM users WHERE email')) {
          return data.users.find(u => u.email === params[0]);
        }
        if (query.includes('SELECT id FROM users WHERE email')) {
          const user = data.users.find(u => u.email === params[0]);
          return user ? { id: user.id } : null;
        }
        
        return null;
      },
      
      all: (...params) => {
        const data = loadDB();
        
        if (query.includes('SELECT id, name, region, created_at FROM saved_routes')) {
          return data.saved_routes
            .filter(r => r.user_id === parseInt(params[0]))
            .map(r => ({ id: r.id, name: r.name, region: r.region, created_at: r.created_at }));
        }
        
        if (query.includes('SELECT * FROM vehicles WHERE user_id')) {
          return data.vehicles.filter(v => v.user_id === parseInt(params[0]));
        }
        
        return [];
      },
      
      run: (...params) => {
        const data = loadDB();
        
        if (query.includes('INSERT INTO users')) {
          const newUser = {
            id: data._nextUserId++,
            email: params[0],
            password_hash: params[1],
            name: params[2],
            created_at: new Date().toISOString()
          };
          data.users.push(newUser);
          saveDB(data);
          return { lastInsertRowid: newUser.id };
        }
        
        if (query.includes('INSERT INTO saved_routes')) {
          const newRoute = {
            id: data._nextRouteId++,
            user_id: params[0],
            name: params[1],
            region: params[2],
            cluster_ids: params[3],
            route_data: params[4],
            created_at: new Date().toISOString()
          };
          data.saved_routes.push(newRoute);
          saveDB(data);
          return { lastInsertRowid: newRoute.id };
        }
        
        if (query.includes('INSERT INTO vehicles')) {
          const newVehicle = {
            id: data._nextVehicleId++,
            user_id: params[0],
            name: params[1],
            width: params[2],
            height: params[3],
            weight: params[4],
            four_wheel_drive: params[5],
            ground_clearance: params[6],
            tire_type: params[7],
            fuel_consumption_onroad: params[8],
            fuel_consumption_offroad: params[9],
            is_default: params[10],
            created_at: new Date().toISOString()
          };
          data.vehicles.push(newVehicle);
          saveDB(data);
          return { lastInsertRowid: newVehicle.id };
        }
        
        if (query.includes('UPDATE vehicles SET is_default = 0')) {
          const userId = parseInt(params[0]);
          if (data.vehicles && Array.isArray(data.vehicles)) {
            data.vehicles.forEach(v => {
              if (v.user_id === userId) {
                v.is_default = 0;
              }
            });
            saveDB(data);
          }
          return { changes: 1 };
        }
        
        if (query.includes('UPDATE vehicles SET is_default = 1')) {
          const vehicleId = parseInt(params[0]);
          const userId = parseInt(params[1]);
          if (data.vehicles && Array.isArray(data.vehicles)) {
            const vehicle = data.vehicles.find(v => v.id === vehicleId && v.user_id === userId);
            if (vehicle) {
              vehicle.is_default = 1;
              saveDB(data);
            }
          }
          return { changes: 1 };
        }
        
        if (query.includes('DELETE FROM saved_routes')) {
          const routeId = parseInt(params[0]);
          const userId = parseInt(params[1]);
          const initialLength = data.saved_routes.length;
          data.saved_routes = data.saved_routes.filter(r => !(r.id === routeId && r.user_id === userId));
          saveDB(data);
          return { changes: initialLength - data.saved_routes.length };
        }
        
        if (query.includes('DELETE FROM vehicles')) {
          const vehicleId = parseInt(params[0]);
          const userId = parseInt(params[1]);
          const initialLength = data.vehicles.length;
          data.vehicles = data.vehicles.filter(v => !(v.id === vehicleId && v.user_id === userId));
          saveDB(data);
          return { changes: initialLength - data.vehicles.length };
        }
        
        return { lastInsertRowid: 0, changes: 0 };
      }
    };
  }
};

console.log('✅ Datenbank initialisiert (JSON-basiert)');

export default db;
