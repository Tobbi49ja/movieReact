import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tobbihub.app',
  appName: 'Tobbihub',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    url: 'https://moviereact-zzye.onrender.com',
    cleartext: false,
    allowNavigation: ['moviereact-zzye.onrender.com'],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 10000,
      launchFadeOutDuration: 250,
      backgroundColor: '#000000',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
  },
};

export default config;
