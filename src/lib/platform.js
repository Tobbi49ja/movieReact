import { Capacitor } from '@capacitor/core';
export const isApp = Capacitor.isNativePlatform();
// flip to true once the APK containing the native popup guard is released
export const NATIVE_POPUP_GUARD = false;
const BASE = 'allow-scripts allow-same-origin allow-forms allow-presentation';
const KEY = 'tb_popup_seen';
export const popupSeen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
export const markPopupSeen = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} };
export const getPlayerSandbox = () =>
  isApp || popupSeen() ? BASE : BASE + ' allow-popups allow-popups-to-escape-sandbox';