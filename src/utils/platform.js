export const isNativeApp = () =>
  typeof window !== "undefined" &&
  (window.Capacitor?.isNativePlatform?.() === true || !!window.electron);
export const APP_URL = import.meta.env.VITE_APP_URL || "";