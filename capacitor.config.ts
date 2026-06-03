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
      '@capacitor/push-notifications',
      '@capacitor/status-bar',
      '@capacitor/camera',
      'capacitor-native-settings',
      '@capacitor-community/bluetooth-le',
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
