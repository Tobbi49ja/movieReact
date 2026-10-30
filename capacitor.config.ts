import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tobbihub.app',
  appName: 'Tobbihub',
  webDir: 'dist',
  backgroundColor: '#0a0a0a',
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
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
  },
};

export default config;
