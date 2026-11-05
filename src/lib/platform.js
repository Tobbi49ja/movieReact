import { Capacitor } from '@capacitor/core';
export const isApp = Capacitor.isNativePlatform();
// Keep the web player un-sandboxed until the native popup guard is actually shipped.
// The hardcoded true value caused third-party players such as Vidfast/Vidrift to fail.
export const NATIVE_POPUP_GUARD = false;
export const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';
export const getPlayerSandbox = () => PLAYER_SANDBOX;