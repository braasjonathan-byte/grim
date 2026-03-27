import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.grim.app',
  appName: 'Grim',
  webDir: 'dist',
  server: {
    url: 'https://8d293547-9e27-403d-a8dd-0848a67777b7.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
