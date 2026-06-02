import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.grim.app',
  appName: 'Grim',
  webDir: 'dist',
  android: {
    includePlugins: [
      '@capacitor/haptics',
      '@capacitor/screen-orientation',
      '@capacitor/geolocation',
      'capacitor-native-settings',
    ],
  },
  ios: {
    // Lock to portrait on iOS
    contentInset: 'always',
  },
  plugins: {
    ScreenOrientation: {
      lockOrientation: 'portrait',
    },
  },
};

export default config;
