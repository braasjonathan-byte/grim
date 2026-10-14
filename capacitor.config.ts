import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.grim.app',
  appName: 'Grim',
  webDir: 'dist',
  // Load the published web app live so recipes, texts and fixes update on
  // every publish without a new AAB. The bundled dist is only a fallback.
  server: {
    url: 'https://grim.lovable.app',
    androidScheme: 'https',
    allowNavigation: ['grim.lovable.app'],
  },
  android: {
    includePlugins: [
      '@capacitor/haptics',
      '@capacitor/screen-orientation',
      '@capacitor/geolocation',
      '@capacitor/push-notifications',
      '@capacitor/status-bar',
      '@capacitor/camera',
      '@capacitor-mlkit/barcode-scanning',
      'capacitor-native-settings',
      '@capacitor-community/bluetooth-le',
      '@capacitor-community/text-to-speech',
      '@capacitor-firebase/app',
      '@capacitor-firebase/crashlytics',
      'capacitor-health',
      'send-intent',
      '@capacitor/dialog',
    ],
  },
  ios: {
    // Lock to portrait on iOS
    contentInset: 'always',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    ScreenOrientation: {
      lockOrientation: 'portrait',
    },
  },
};

export default config;
