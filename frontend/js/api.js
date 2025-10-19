// API Client für Backend-Kommunikation
const API_BASE_URL = 'http://localhost:3001/api';

const api = {
    // Helper: Fetch mit Token
    async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers
        });
        
        if (response.status === 401 || response.status === 403) {
            // Token ungültig - logout
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            alert('Session abgelaufen - bitte neu einloggen');
            window.location.href = 'index.html';
            throw new Error('Session abgelaufen');
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'API Fehler' }));
            throw new Error(error.error || 'API Fehler');
        }
        
        return response.json();
    },
    
    // Auth
    async register(email, password, name) {
        return this.fetchWithAuth('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
    },
    
    async login(email, password) {
        return this.fetchWithAuth('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    // Regions
    async getRegions() {
        return this.fetchWithAuth('/regions');
    },
    
    async getRegion(regionId) {
        return this.fetchWithAuth(`/regions/${regionId}`);
    },
    
    async getClusters(regionId) {
        return this.fetchWithAuth(`/regions/${regionId}/clusters`);
    },
    
    // Routes
    async calculateRoute(regionId, clusterIds, maxOffroadPerDay = 80) {
        return this.fetchWithAuth('/routes/calculate', {
            method: 'POST',
            body: JSON.stringify({ regionId, clusterIds, maxOffroadPerDay })
        });
    },
    
    async getSavedRoutes() {
        return this.fetchWithAuth('/routes/saved');
    },
    
    async getSavedRoute(routeId) {
        return this.fetchWithAuth(`/routes/saved/${routeId}`);
    },
    
    async saveRoute(name, region, clusterIds, routeData) {
        return this.fetchWithAuth('/routes/save', {
            method: 'POST',
            body: JSON.stringify({ name, region, clusterIds, routeData })
        });
    },
    
    async deleteRoute(routeId) {
        return this.fetchWithAuth(`/routes/saved/${routeId}`, {
            method: 'DELETE'
        });
    },
    
    // Vehicles
    async getVehicles() {
        return this.fetchWithAuth('/vehicles');
    },
    
    async getDefaultVehicle() {
        return this.fetchWithAuth('/vehicles/default');
    },
    
    async createVehicle(vehicleData) {
        return this.fetchWithAuth('/vehicles', {
            method: 'POST',
            body: JSON.stringify(vehicleData)
        });
    },
    
    async setDefaultVehicle(vehicleId) {
        return this.fetchWithAuth(`/vehicles/${vehicleId}/default`, {
            method: 'PUT'
        });
    },
    
    async deleteVehicle(vehicleId) {
        return this.fetchWithAuth(`/vehicles/${vehicleId}`, {
            method: 'DELETE'
        });
    },
    
    // Budget Radar
    async budgetRadar(budget, radius, startPoint, days, regionId) {
        return this.fetchWithAuth('/routes/budget-radar', {
            method: 'POST',
            body: JSON.stringify({ budget, radius, startPoint, days, regionId })
        });
    },
    
    // GPX Export
    async exportRouteGPX(routeId) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/routes/export/${routeId}/gpx`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('GPX-Export fehlgeschlagen');
        }
        
        const blob = await response.blob();
        return blob;
    },
    
    async exportCurrentRouteGPX(routeData, name, region) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/routes/export/gpx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ routeData, name, region })
        });
        
        if (!response.ok) {
            throw new Error('GPX-Export fehlgeschlagen');
        }
        
        const blob = await response.blob();
        return blob;
    },
    
    // POIs
    async getPOIsNear(lat, lon, radius = 50, types = 'water,disposal,camping') {
        const response = await fetch(`${API_BASE_URL}/pois/near?lat=${lat}&lon=${lon}&radius=${radius}&types=${types}`);
        if (!response.ok) throw new Error('POI-Laden fehlgeschlagen');
        return response.json();
    },
    
    async getPOIsForRoute(region, clusterIds, radius = 20, types = ['water', 'disposal', 'camping']) {
        const response = await fetch(`${API_BASE_URL}/pois/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region, clusterIds, radius, types })
        });
        if (!response.ok) throw new Error('POI-Laden fehlgeschlagen');
        return response.json();
    },
    
    // Quests
    async getQuestsNearby(lat, lon, radius = 50) {
        return this.fetchWithAuth(`/quests/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
    },
    
    async getQuestsByRegion(region) {
        return this.fetchWithAuth(`/quests/region/${region}`);
    },
    
    async startQuest(questId) {
        return this.fetchWithAuth(`/quests/${questId}/start`, {
            method: 'POST'
        });
    },
    
    async completeQuest(questId) {
        return this.fetchWithAuth(`/quests/${questId}/complete`, {
            method: 'POST'
        });
    },
    
    async getQuestProgress() {
        return this.fetchWithAuth('/quests/progress');
    },
    
    // Profile & Stats
    async getProfile() {
        return this.fetchWithAuth('/profile');
    },
    
    async updateStats(distanceKm, offroadKm, elevationM) {
        return this.fetchWithAuth('/profile/update-stats', {
            method: 'POST',
            body: JSON.stringify({
                distance_km: distanceKm,
                offroad_km: offroadKm,
                elevation_m: elevationM
            })
        });
    },
    
    // Badges
    async getBadges() {
        return this.fetchWithAuth('/badges');
    },
    
    async getUserBadges() {
        return this.fetchWithAuth('/badges/user');
    },
    
    async getBadgeProgress() {
        return this.fetchWithAuth('/badges/progress');
    },
    
    // Accommodations
    async searchAccommodations(lat, lon, radius = 50, options = {}) {
        const params = new URLSearchParams({
            lat,
            lon,
            radius,
            ...options
        });
        return this.fetchWithAuth(`/accommodations/search?${params}`);
    },
    
    async getAccommodation(id) {
        return this.fetchWithAuth(`/accommodations/${id}`);
    },
    
    async addAccommodationReview(id, rating, comment, visitedDate) {
        return this.fetchWithAuth(`/accommodations/${id}/review`, {
            method: 'POST',
            body: JSON.stringify({ rating, comment, visitedDate })
        });
    }
};
