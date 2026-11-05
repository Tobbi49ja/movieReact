import { Capacitor } from '@capacitor/core';
export const isApp = Capacitor.isNativePlatform();
// flip to true once the APK containing the native popup guard is released
export const NATIVE_POPUP_GUARD = true;
export const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox';
export const getPlayerSandbox = () => PLAYER_SANDBOX;