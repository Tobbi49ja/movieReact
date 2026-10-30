import { useState, useEffect } from "react";

export function isNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export const APP_URL = import.meta.env.VITE_APP_URL || "https://moviereact-zzye.onrender.com";

const STORAGE_KEY = "tb_datasaver";
const DEFAULT_ON = true;
const DEFAULT_OFF = false;

function detectDefault() {
  if (typeof window === "undefined") return DEFAULT_OFF;
  if (isNativeApp()) return DEFAULT_ON;
  try {
    const conn = navigator.connection;
    if (conn) {
      if (conn.saveData) return DEFAULT_ON;
      const slowTypes = new Set(["slow-2g", "2g", "3g"]);
      if (conn.effectiveType && slowTypes.has(conn.effectiveType)) return DEFAULT_ON;
    }
  } catch {
    // ignore
  }
  return DEFAULT_OFF;
}

const subscribers = new Set();

function notify(value) {
  for (const cb of subscribers) {
    try {
      cb(value);
    } catch {
      // ignore
    }
  }
}

export function getStoredDataSaver() {
  if (typeof window === "undefined") return DEFAULT_OFF;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return detectDefault();
}

export function isDataSaver() {
  return getStoredDataSaver();
}

export function setDataSaver(next) {
  const value = !!next;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
  notify(value);
  return value;
}

export function subscribeDataSaver(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function useDataSaver() {
  const [enabled, setEnabled] = useState(() => getStoredDataSaver());

  useEffect(() => {
    const onSync = (v) => setEnabled(!!v);
    const unsub = subscribeDataSaver(onSync);

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setEnabled(e.newValue === "1");
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }

    return () => {
      unsub();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }, []);

  return {
    enabled,
    setEnabled: (v) => setDataSaver(v),
    toggle: () => setDataSaver(!enabled),
  };
}