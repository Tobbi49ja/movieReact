import { Directory, Filesystem } from "@capacitor/filesystem";
import { getDownloads, updateDownload } from "./downloads";

function clampProgress(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export async function startDownload(recordId, { url, headers = {} } = {}) {
  if (!recordId) {
    throw new Error("A download record id is required.");
  }

  const downloads = getDownloads();
  const record = downloads.find((entry) => entry.id === recordId);

  if (!record) {
    throw new Error("Download record not found.");
  }

  if (!url || typeof url !== "string") {
    throw new Error("Download URL is required.");
  }

  const hasCustomHeaders = !!headers && Object.keys(headers).length > 0;
  if (hasCustomHeaders) {
    // Capacitor Filesystem.downloadFile does not expose custom request headers in JS.
    // The request still proceeds with the direct URL and will be retried if needed.
  }

  const targetPath = `downloads/${recordId}.mp4`;
  let listenerHandle = null;

  const cleanupListener = async () => {
    if (listenerHandle && typeof listenerHandle.remove === "function") {
      try {
        await listenerHandle.remove();
      } catch {
        // ignore listener cleanup failures
      }
    }
  };

  let attempt = 0;
  while (attempt <= 1) {
    try {
      updateDownload(recordId, {
        status: "downloading",
        progress: 0,
        path: "",
        size: record.size || "",
      });

      listenerHandle = await Filesystem.addListener("progress", (progress) => {
        const bytes = Number(progress?.bytes || 0);
        const contentLength = Number(progress?.contentLength || 0);
        const percent = contentLength > 0 ? (bytes / contentLength) * 100 : 0;

        updateDownload(recordId, {
          status: "downloading",
          progress: clampProgress(percent),
        });
      });

      const result = await Filesystem.downloadFile({
        url,
        path: targetPath,
        directory: Directory.Data,
        progress: true,
      });

      await cleanupListener();

      const fileInfo = await Filesystem.getUri({
        directory: Directory.Data,
        path: targetPath,
      });

      const stat = await Filesystem.stat({
        directory: Directory.Data,
        path: targetPath,
      });

      const filePath = fileInfo?.uri || fileInfo?.path || result?.path || targetPath;
      const size = typeof stat?.size === "number" ? stat.size : record.size || 0;

      updateDownload(recordId, {
        status: "done",
        progress: 100,
        path: filePath,
        size,
      });

      return { ...result, path: filePath };
    } catch (error) {
      await cleanupListener();
      const message = error?.message || "Download failed.";

      if (attempt < 1) {
        attempt += 1;
        continue;
      }

      updateDownload(recordId, {
        status: "failed",
        progress: 0,
        path: "",
        message,
      });
      throw new Error(message);
    }
  }

  return null;
}

export function pauseDownload(recordId) {
  if (!recordId) return null;
  // Capacitor Filesystem cannot pause an active download; this is a TODO for native resume support.
  updateDownload(recordId, { status: "paused" });
  return recordId;
}

export function resumeDownload(recordId) {
  if (!recordId) return null;
  // TODO: wire native resume support when the platform exposes resumable download control.
  updateDownload(recordId, { status: "queued" });
  return recordId;
}
