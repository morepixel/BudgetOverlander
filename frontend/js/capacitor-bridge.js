/**
 * DaysLeft - Capacitor Bridge
 * Native Features für iOS/Android
 */

// Capacitor Imports (werden zur Laufzeit geladen)
let Capacitor, Preferences, Network, LocalNotifications, StatusBar, SplashScreen;

// Initialisierung
async function initCapacitor() {
    // Prüfen ob wir in einer nativen App laufen
    if (typeof window.Capacitor === 'undefined') {
        console.log('Running in browser mode - Capacitor not available');
        return false;
    }
    
    Capacitor = window.Capacitor;
    
    // Plugins laden
    try {
        Preferences = Capacitor.Plugins.Preferences;
        Network = Capacitor.Plugins.Network;
        LocalNotifications = Capacitor.Plugins.LocalNotifications;
        StatusBar = Capacitor.Plugins.StatusBar;
        SplashScreen = Capacitor.Plugins.SplashScreen;
        
        // StatusBar konfigurieren
        if (StatusBar) {
            await StatusBar.setStyle({ style: 'Dark' });
            await StatusBar.setBackgroundColor({ color: '#1a3a1a' });
        }
        
        // SplashScreen nach Init ausblenden
        if (SplashScreen) {
            setTimeout(() => SplashScreen.hide(), 500);
        }
        
        // Network Listener
        if (Network) {
            Network.addListener('networkStatusChange', (status) => {
                console.log('Network status:', status);
                handleNetworkChange(status.connected);
            });
        }
        
        console.log('Capacitor initialized successfully');
        return true;
    } catch (e) {
        console.error('Capacitor init error:', e);
        return false;
    }
}

// ============================================
// OFFLINE STORAGE (Preferences)
// ============================================

async function saveOfflineData(key, data) {
    if (!Preferences) {
        // Fallback zu localStorage
        localStorage.setItem(`offline_${key}`, JSON.stringify(data));
        return;
    }
    
    await Preferences.set({
        key: `offline_${key}`,
        value: JSON.stringify(data)
    });
}

async function getOfflineData(key) {
    if (!Preferences) {
        // Fallback zu localStorage
        const data = localStorage.getItem(`offline_${key}`);
        return data ? JSON.parse(data) : null;
    }
    
    const { value } = await Preferences.get({ key: `offline_${key}` });
    return value ? JSON.parse(value) : null;
}

async function removeOfflineData(key) {
    if (!Preferences) {
        localStorage.removeItem(`offline_${key}`);
        return;
    }
    
    await Preferences.remove({ key: `offline_${key}` });
}

// ============================================
// NETWORK STATUS
// ============================================

let isOnline = true;

async function checkNetworkStatus() {
    if (!Network) {
        return navigator.onLine;
    }
    
    const status = await Network.getStatus();
    isOnline = status.connected;
    return isOnline;
}

function handleNetworkChange(connected) {
    isOnline = connected;
    
    // UI-Feedback
    const offlineBanner = document.getElementById('offlineBanner');
    if (offlineBanner) {
        offlineBanner.style.display = connected ? 'none' : 'block';
    }
    
    // Bei Reconnect: Pending Changes synchen
    if (connected) {
        syncPendingChanges();
    }
}

// ============================================
// OFFLINE SYNC QUEUE
// ============================================

async function addToSyncQueue(action, endpoint, data) {
    const queue = await getOfflineData('syncQueue') || [];
    queue.push({
        id: Date.now(),
        action,
        endpoint,
        data,
        timestamp: new Date().toISOString()
    });
    await saveOfflineData('syncQueue', queue);
}

async function syncPendingChanges() {
    const queue = await getOfflineData('syncQueue') || [];
    if (queue.length === 0) return;
    
    console.log(`Syncing ${queue.length} pending changes...`);
    
    const failedItems = [];
    
    for (const item of queue) {
        try {
            const response = await fetch(`${API_BASE}${item.endpoint}`, {
                method: item.action,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(item.data)
            });
            
            if (!response.ok) {
                failedItems.push(item);
            }
        } catch (e) {
            failedItems.push(item);
        }
    }
    
    await saveOfflineData('syncQueue', failedItems);
    
    if (failedItems.length === 0) {
        console.log('All changes synced successfully');
    } else {
        console.log(`${failedItems.length} items failed to sync`);
    }
}

// ============================================
// LOCAL NOTIFICATIONS
// ============================================

async function requestNotificationPermission() {
    if (!LocalNotifications) return false;
    
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
}

async function scheduleResourceWarning(resourceName, percentage, daysLeft) {
    if (!LocalNotifications) return;
    
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;
    
    await LocalNotifications.schedule({
        notifications: [
            {
                id: Math.floor(Math.random() * 100000),
                title: `⚠️ ${resourceName} niedrig!`,
                body: `Nur noch ${percentage}% (${daysLeft} Tage) übrig.`,
                schedule: { at: new Date(Date.now() + 1000) },
                smallIcon: 'ic_stat_icon',
                iconColor: '#4CAF50'
            }
        ]
    });
}

async function scheduleDailyReminder(hour = 9, minute = 0) {
    if (!LocalNotifications) return;
    
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;
    
    // Tägliche Erinnerung
    await LocalNotifications.schedule({
        notifications: [
            {
                id: 99999,
                title: '📊 DaysLeft Check',
                body: 'Zeit deine Ressourcen zu aktualisieren!',
                schedule: {
                    on: { hour, minute },
                    repeats: true
                },
                smallIcon: 'ic_stat_icon',
                iconColor: '#4CAF50'
            }
        ]
    });
}

// ============================================
// OFFLINE-FÄHIGE API CALLS
// ============================================

async function offlineFetch(endpoint, options = {}) {
    const isConnected = await checkNetworkStatus();
    
    if (!isConnected) {
        // Offline: Aus Cache laden oder Queue hinzufügen
        if (options.method === 'GET' || !options.method) {
            return await getOfflineData(`cache_${endpoint}`);
        } else {
            // Write-Operation: In Queue
            await addToSyncQueue(options.method, endpoint, JSON.parse(options.body || '{}'));
            return { offline: true, queued: true };
        }
    }
    
    // Online: Normaler Fetch + Cache
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`,
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        // GET-Requests cachen
        if (options.method === 'GET' || !options.method) {
            await saveOfflineData(`cache_${endpoint}`, data);
        }
        
        return data;
    } catch (e) {
        // Bei Fehler: Aus Cache
        console.error('Fetch error, trying cache:', e);
        return await getOfflineData(`cache_${endpoint}`);
    }
}

// ============================================
// CACHE VEHICLE & RESOURCES
// ============================================

async function cacheCurrentState() {
    if (currentVehicle) {
        await saveOfflineData('vehicle', currentVehicle);
    }
    if (currentLevels) {
        await saveOfflineData('levels', currentLevels);
    }
}

async function loadCachedState() {
    const vehicle = await getOfflineData('vehicle');
    const levels = await getOfflineData('levels');
    return { vehicle, levels };
}

// ============================================
// INIT
// ============================================

// Beim Laden initialisieren
document.addEventListener('DOMContentLoaded', async () => {
    const isNative = await initCapacitor();
    
    if (isNative) {
        console.log('Running as native app');
        
        // Offline-Banner hinzufügen
        const banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;background:#e74c3c;color:white;padding:8px;text-align:center;z-index:9999;font-size:12px;';
        banner.textContent = '📡 Offline - Änderungen werden synchronisiert sobald du wieder online bist';
        document.body.prepend(banner);
        
        // Initialer Network-Check
        const connected = await checkNetworkStatus();
        handleNetworkChange(connected);
    }
});

// Export für globalen Zugriff
window.CapacitorBridge = {
    saveOfflineData,
    getOfflineData,
    removeOfflineData,
    checkNetworkStatus,
    addToSyncQueue,
    syncPendingChanges,
    scheduleResourceWarning,
    scheduleDailyReminder,
    offlineFetch,
    cacheCurrentState,
    loadCachedState
};
