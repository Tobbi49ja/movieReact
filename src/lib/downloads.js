const STORAGE_KEY = "tobbihub_downloads";
const listeners = new Set();

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readDownloads() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse downloads from localStorage:", error);
    return [];
  }
}

function writeDownloads(next) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Failed to save downloads to localStorage:", error);
  }
}

function notify() {
  const next = readDownloads();
  listeners.forEach((cb) => {
    try {
      cb(next);
    } catch (error) {
      console.error("Download subscriber failed:", error);
    }
  });
}

export function getDownloads() {
  return readDownloads();
}

export function addDownload(download = {}) {
  const entries = readDownloads();
  const entry = {
    id: download.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tmdbId: download.tmdbId ?? null,
    type: download.type || "movie",
    season: download.season ?? null,
    episode: download.episode ?? null,
    title: download.title || "Download",
    poster: download.poster || "",
    quality: download.quality || "1080p",
    status: download.status || "queued",
    progress: Number.isFinite(download.progress) ? Math.min(Math.max(download.progress, 0), 100) : 0,
    path: download.path || "",
    size: download.size || "",
    createdAt: download.createdAt || new Date().toISOString(),
    ...download,
  };

  const next = [entry, ...entries];
  writeDownloads(next);
  notify();
  return entry;
}

export function updateDownload(id, patch = {}) {
  const entries = readDownloads();
  const next = entries.map((entry) => {
    if (entry.id !== id) return entry;
    return { ...entry, ...patch };
  });

  writeDownloads(next);
  notify();
  return next.find((entry) => entry.id === id) || null;
}

export function removeDownload(id) {
  const entries = readDownloads().filter((entry) => entry.id !== id);
  writeDownloads(entries);
  notify();
  return entries;
}

export function subscribe(cb) {
  if (typeof cb !== "function") {
    return () => {};
  }

  listeners.add(cb);
  return () => listeners.delete(cb);
}
