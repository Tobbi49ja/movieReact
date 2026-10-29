import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tobbihub.app',
  appName: 'Tobbihub',
  webDir: 'dist',
  server: {
    url: 'https://moviereact-zzye.onrender.com',
    cleartext: false,
    allowNavigation: ['moviereact-zzye.onrender.com'],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
