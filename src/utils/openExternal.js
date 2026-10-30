import toast from "react-hot-toast";
import { isNativeApp } from "./platform";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

function hostOf(url) {
  try {
    return new URL(url, window.location.origin).host;
  } catch {
    return "";
  }
}

function isAllowed(url, config) {
  const trimmed = String(url || "").trim();
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return true;
  let parsed;
  try {
    parsed = new URL(trimmed, window.location.origin);
  } catch {
    return false;
  }
  if (parsed.origin === window.location.origin) return true;
  const allowedHosts = new Set();
  if (config?.apkUrl) {
    const h = hostOf(config.apkUrl);
    if (h) allowedHosts.add(h);
  }
  (config?.externalLinks || []).forEach((l) => {
    const h = hostOf(l?.url);
    if (h) allowedHosts.add(h);
  });
  // site own backend host
  allowedHosts.add(hostOf(BACKEND_URL));
  return allowedHosts.has(parsed.host);
}

export async function openExternal(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    toast.error("No link available");
    return false;
  }
  // resolve relative
  let resolved = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith("//")) {
    try {
      resolved = new URL(trimmed, window.location.origin).href;
    } catch {
      resolved = trimmed;
    }
  }
  // lazy load config
  let config = null;
  try {
    const { fetchAppConfig } = await import("./appConfig");
    config = await fetchAppConfig();
  } catch {
    config = null;
  }
  if (!isAllowed(resolved, config)) {
    toast.error("This link is not allowed");
    return false;
  }
  const scheme = resolved.split(":")[0].toLowerCase();
  if (isNativeApp()) {
    if (scheme === "mailto" || scheme === "tel") {
      window.location.href = resolved;
      return true;
    }
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: resolved });
      return true;
    } catch {
      window.open(resolved, "_blank", "noopener,noreferrer");
      return true;
    }
  }
  window.open(resolved, "_blank", "noopener,noreferrer");
  return true;
}