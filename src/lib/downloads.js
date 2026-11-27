import { Capacitor, registerPlugin } from "@capacitor/core";

const STORAGE_KEY = "tobbihub_downloads";
const listeners = new Set();
let progressWired = false;

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

function resolveTotalBytes(event, existing) {
  const direct = Number(event?.totalBytes);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const done = Number(event?.bytesDone);
  const percent = Number(event?.percent);
  if (Number.isFinite(done) && done > 0 && Number.isFinite(percent) && percent > 0) {
    return Math.round(done / (percent / 100));
  }
  return Number(existing?.totalBytes) || 0;
}

function wireProgressListener() {
  if (progressWired || typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return;
  progressWired = true;
  try {
    const plugin = registerPlugin("Downloader");
    Promise.resolve(plugin.addListener("downloadProgress", (event) => {
      if (!event || !event.id) return;
      const existing = getDownloads().find((d) => d.id === event.id);
      updateDownload(event.id, {
        bytesDone: Number.isFinite(event.bytesDone) ? event.bytesDone : (existing?.bytesDone ?? 0),
        totalBytes: resolveTotalBytes(event, existing) || Number(existing?.totalBytes) || 0,
      });
    })).catch(() => {});
  } catch {
    progressWired = false;
  }
}

export function addDownload(download = {}) {
  wireProgressListener();
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
    totalBytes: Number.isFinite(download.totalBytes) ? download.totalBytes : 0,
    bytesDone: Number.isFinite(download.bytesDone) ? download.bytesDone : 0,
    estBytes: Number.isFinite(download.estBytes)
      ? download.estBytes
      : (Number(download.quality?.estBytes) || Number(download.selectedQuality?.estBytes) || 0),
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

export function mergeDownload(item = {}) {
  if (!item.id) return null;
  const existing = getDownloads().find((d) => d.id === item.id);
  if (existing) return updateDownload(item.id, item);
  return addDownload(item);
}

export function removeDownload(id) {
  const entries = readDownloads().filter((entry) => entry.id !== id);
  writeDownloads(entries);
  notify();
  return entries;
}

export async function deleteDownloadWithFile(item) {
  const id = typeof item === "string" ? item : item?.id;
  if (!id) return;
  try {
    const { cancel } = await import("./downloader");
    await cancel(id);
  } catch {}
  removeDownload(id);
}

export function subscribe(cb) {
  if (typeof cb !== "function") {
    return () => {};
  }

  listeners.add(cb);
  return () => listeners.delete(cb);
}
