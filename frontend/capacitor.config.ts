import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.morepixel.daysleft',
  appName: 'DaysLeft',
  webDir: 'www',
  // Server-Config entfernt - App nutzt lokale Web-Assets
  // API-Calls gehen weiterhin an die Live-API (in offgrid.html definiert)
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a3a1a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1a3a1a'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#4CAF50'
    },
    Preferences: {
      // Für Offline-Speicherung
    }
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'DaysLeft',
    backgroundColor: '#1a3a1a'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a3a1a'
  }
};

export default config;
