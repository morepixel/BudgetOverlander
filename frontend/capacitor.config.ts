import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morepixel.daysleft',
  appName: 'DaysLeft',
  webDir: 'www',
  // Server-Config entfernt - App nutzt lokale Web-Assets
  // API-Calls gehen weiterhin an die Live-API (in offgrid.html definiert)
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2E7D32',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#2E7D32'
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
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'DaysLeft',
    backgroundColor: '#2E7D32',
    scrollEnabled: true,
    allowsLinkPreview: false
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#2E7D32'
  }
};

export default config;
