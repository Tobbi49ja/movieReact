import { Capacitor } from '@capacitor/core';
export const isApp = Capacitor.isNativePlatform();
const BASE = 'allow-scripts allow-same-origin allow-forms allow-presentation';
export const playerSandbox = isApp
  ? BASE
  : BASE + ' allow-popups allow-popups-to-escape-sandbox';