import { Capacitor, registerPlugin } from '@capacitor/core';
import { notifyDownloadDone } from './notify';

const Downloader = registerPlugin('Downloader');

export const start = (req) => Downloader.start(req);
export const pause = (id) => Downloader.pause({ id });
export const resume = (id, req = {}) => Downloader.resume({ id, ...req });
export const cancel = (id) => Downloader.cancel({ id });
export const list = () => Downloader.list();
export const storageInfo = () => Downloader.storageInfo();
export const play = (path) => Downloader.play({ path });

export const saveSubtitle = async ({ downloadId, lang, label, content }) =>
  (await Downloader.saveSubtitle({ downloadId, lang, label, content }))?.subtitles || [];
export const importSubtitle = async ({ downloadId }) =>
  (await Downloader.importSubtitle({ downloadId }))?.subtitles || [];
export const listSubtitles = async ({ downloadId }) =>
  (await Downloader.listSubtitles({ downloadId }))?.subtitles || [];
export const deleteSubtitle = async ({ downloadId, id }) =>
  (await Downloader.deleteSubtitle({ downloadId, id }))?.subtitles || [];

let initialized = false;
let handles = [];

function mergeItem(item = {}) {
  const { getDownloads, addDownload, updateDownload } = require('./downloads');
  const existing = getDownloads().find((d) => d.id === item.id);
  const patch = {
    id: item.id,
    title: item.title ?? existing?.title ?? 'Download',
    status: item.status ?? existing?.status ?? 'queued',
    progress: Number.isFinite(item.percent) ? item.percent : (Number.isFinite(item.progress) ? item.progress : (existing?.progress ?? 0)),
    path: item.path ?? existing?.path ?? '',
    size: item.size ?? existing?.size ?? '',
    errorCode: item.errorCode ?? item.code ?? existing?.errorCode ?? '',
    error: item.error ?? item.message ?? existing?.error ?? '',
    speedBps: item.speedBps ?? existing?.speedBps ?? 0,
    etaSec: item.etaSec ?? existing?.etaSec ?? 0,
  };
  if (existing) updateDownload(item.id, patch);
  else addDownload(patch);
}

export async function initDownloader() {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;
  try {
    const res = await list();
    const items = res?.items || [];
    items.forEach((item) => {
      try { mergeItem(typeof item === 'string' ? JSON.parse(item) : item); } catch {}
    });
  } catch {}
  const { getDownloads, updateDownload } = await import('./downloads');
  const { invalidateResolveCache } = await import('./resolver');
  handles = [
    await Downloader.addListener('downloadStarted', ({ id }) => updateDownload(id, { status: 'downloading' })),
    await Downloader.addListener('downloadProgress', (d) => updateDownload(d.id, { status: 'downloading', progress: d.percent ?? 0, speedBps: d.speedBps ?? 0, etaSec: d.etaSec ?? 0 })),
    await Downloader.addListener('downloadPaused', ({ id }) => updateDownload(id, { status: 'paused' })),
    await Downloader.addListener('downloadComplete', ({ id, path, size }) => {
      updateDownload(id, { status: 'done', progress: 100, path: path || '', size: size ?? '' });
      notifyDownloadDone(getDownloads().find((d) => d.id === id)?.title || 'Your download');
    }),
    await Downloader.addListener('downloadError', ({ id, code, message }) => {
      updateDownload(id, { status: 'failed', errorCode: code || '', error: message || '' });
      const failed = getDownloads().find((d) => d.id === id);
      invalidateResolveCache(failed?.providerId, failed?.embedUrl);
    }),
  ];
}

export function cleanupDownloader() {
  handles.forEach((h) => { try { h.remove(); } catch {} });
  handles = [];
  initialized = false;
}
