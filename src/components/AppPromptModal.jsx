// src/components/AppPromptModal.jsx
import { useEffect, useRef, useState } from "react";
import { FiX, FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isNativeApp, APP_URL } from "../utils/platform";
import { fetchAppConfig } from "../utils/appConfig";
import { startDownload, listDownloads, deleteDownload, clearDownloads } from "../utils/downloads";

const QUALITY_OPTIONS = [
  { value: "best", label: "Best available" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
];

const SUBTITLE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
  { value: "pt", label: "Portuguese" },
];

export default function AppPromptModal({ isOpen, onClose, itemTitle }) {
  const primaryRef = useRef(null);
  const [appUrl, setAppUrl] = useState(APP_URL);
  const [streamUrl, setStreamUrl] = useState("");
  const [downloadJobs, setDownloadJobs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [quality, setQuality] = useState("best");
  const [subtitlePrefs, setSubtitlePrefs] = useState(["en"]);

  useEffect(() => {
    fetchAppConfig().then((c) => { if (c?.apkUrl) setAppUrl(c.apkUrl); });
  }, []);

  useEffect(() => {
    if (!isOpen || isNativeApp()) return;
    let mounted = true;

    const load = async () => {
      try {
        const jobs = await listDownloads();
        if (mounted) setDownloadJobs(Array.isArray(jobs) ? jobs : []);
      } catch (error) {
        console.error("Failed to load downloads:", error);
      }
    };

    load();
    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => primaryRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isNativeApp()) return;
    toast.success("Download to device is available in the app");
  }, [isOpen]);

  const handleSubtitleToggle = (language) => {
    setSubtitlePrefs((prev) => {
      if (prev.includes(language)) {
        return prev.filter((item) => item !== language);
      }
      return [...prev, language];
    });
  };

  const handleNativeDownload = async () => {
    const url = streamUrl.trim();
    if (!url) {
      setDownloadError("Paste a valid http or https stream URL first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setDownloadError("");

      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error("Only http and https sources are supported.");
      }

      const response = await fetch(url, { headers: { Accept: "video/*,application/octet-stream,*/*" } });
      if (!response.ok) {
        throw new Error(`Download request failed (${response.status}).`);
      }

      const blob = await response.blob();
      const fileName = (itemTitle || "tobbihub-download")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "tobbihub-download";
      const ext = (parsed.pathname.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
      const safeFileName = `${fileName}.${ext}`;

      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);

      const writeResult = await Filesystem.writeFile({
        path: `Downloads/${safeFileName}`,
        data: base64,
        directory: Directory.Documents,
      });

      setDownloadJobs((prev) => [{
        id: `native-${Date.now()}`,
        name: itemTitle || "Download",
        status: "saved",
        progress: 100,
        filePath: writeResult.uri || safeFileName,
        lastMessage: `Saved to device storage (${safeFileName})`,
      }, ...prev]);
      setStreamUrl("");
      toast.success(`Saved: ${safeFileName}`);
    } catch (error) {
      console.error("Native download failed:", error);
      setDownloadError(error?.message || "Unable to download to your device.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDownload = async () => {
    if (!streamUrl.trim()) {
      setDownloadError("Paste a valid http or https stream URL first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setDownloadError("");

      if (isNativeApp()) {
        await handleNativeDownload();
        return;
      }

      const payload = {
        m3u8Url: streamUrl.trim(),
        title: itemTitle || "Tobbihub download",
        downloadPath: "downloads",
        mediaType: "movie",
        quality,
        subtitles: subtitlePrefs,
      };

      const created = await startDownload(payload);
      setDownloadJobs((prev) => [created, ...prev]);
      setStreamUrl("");
      toast.success("Download started");
    } catch (error) {
      setDownloadError(error?.response?.data?.message || error.message || "Unable to start download.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDownload(id);
      setDownloadJobs((prev) => prev.filter((job) => job.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleClear = async () => {
    try {
      await clearDownloads();
      setDownloadJobs([]);
    } catch (error) {
      console.error("Clear downloads failed:", error);
    }
  };

  if (!isOpen) return null;

  const hasAppUrl = !!appUrl;

  return (
    <div
      className="download-modal-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="app-prompt-title"
    >
      <div
        className="download-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "640px", width: "min(90vw, 640px)" }}
      >
        <div className="download-modal-header">
          <div className="download-title-group">
            <FiDownload className="modal-header-icon" />
            <div>
              <h3 id="app-prompt-title">Download in the Tobbihub app</h3>
              <p className="download-subtitle">{itemTitle || "This title"}</p>
            </div>
          </div>
          <button
            className="download-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FiX />
          </button>
        </div>

        <div className="app-prompt-body" style={{ display: "grid", gap: "1rem" }}>
          <p className="app-prompt-text">
            Downloads are available in the app only. Stream here on the web;
            install the app to save movies and episodes for offline viewing.
          </p>

          {hasAppUrl && !isNativeApp() && (
            <ol className="app-install-steps" style={{ margin: "0.75rem 0 0", padding: "0 0 0 1.2rem", fontSize: "0.85rem", lineHeight: 1.5 }}>
              <li>Tap Get the app and open the downloaded file.</li>
              <li>If Android asks, allow installs from this browser.</li>
              <li>If Play Protect warns, choose Install anyway.</li>
            </ol>
          )}

          <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "0.9rem" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Server download</div>
            <label htmlFor="stream-url" style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
              Stream URL
            </label>
            <input
              id="stream-url"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://example.com/stream.m3u8"
              style={{ width: "100%", padding: "0.7rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,10,10,0.45)", color: "#fff" }}
            />

            {downloadError && (
              <p style={{ margin: "0.6rem 0 0", color: "#ff8a8a", fontSize: "0.8rem" }}>{downloadError}</p>
            )}

            <div style={{ display: "grid", gap: "0.8rem", marginTop: "0.9rem" }}>
              <div>
                <label htmlFor="download-quality" style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
                  Quality preference
                </label>
                <select
                  id="download-quality"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ width: "100%", padding: "0.7rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,10,10,0.45)", color: "#fff" }}
                >
                  {QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: "0.45rem", fontSize: "0.8rem" }}>Subtitle preference</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  {SUBTITLE_OPTIONS.map((option) => {
                    const active = subtitlePrefs.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSubtitleToggle(option.value)}
                        style={{
                          padding: "0.45rem 0.65rem",
                          borderRadius: "999px",
                          border: `1px solid ${active ? "rgba(122, 203, 255, 0.7)" : "rgba(255,255,255,0.12)"}`,
                          background: active ? "rgba(122, 203, 255, 0.18)" : "rgba(255,255,255,0.02)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="popup-actions" style={{ marginTop: "0.75rem", justifyContent: "flex-start" }}>
              <button className="server-download-btn btn-primary" onClick={handleStartDownload} disabled={isSubmitting}>
                <FiDownload /> {isSubmitting ? "Starting..." : "Start download"}
              </button>
              <button className="server-mirror-btn btn-ghost" onClick={handleClear} type="button">Clear</button>
            </div>
          </div>

          {downloadJobs.length > 0 && (
            <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "0.9rem" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Downloads</div>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {downloadJobs.map((job) => (
                  <div key={job.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "0.7rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.85rem" }}>{job.name}</strong>
                      <button type="button" onClick={() => handleDelete(job.id)} style={{ background: "transparent", border: "none", color: "#ff9999", cursor: "pointer" }}>Delete</button>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#d5d5d5" }}>
                      {job.status} · {job.progress || 0}%
                    </div>
                    {job.filePath && (
                      <div style={{ fontSize: "0.72rem", color: "#a9d3ff", wordBreak: "break-all" }}>{job.filePath}</div>
                    )}
                    {job.lastMessage && (
                      <div style={{ fontSize: "0.72rem", color: "#d4d4d4", marginTop: "0.35rem" }}>{job.lastMessage}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="download-modal-footer popup-actions">
          <button
            className="server-mirror-btn btn-ghost"
            onClick={onClose}
          >
            Maybe later
          </button>
          {isNativeApp() ? (
            <button
              ref={primaryRef}
              className="server-download-btn btn-primary"
              onClick={onClose}
            >
              <FiDownload /> Coming soon
            </button>
          ) : hasAppUrl ? (
            <a
              ref={primaryRef}
              href={appUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="server-download-btn btn-primary"
              style={{ textDecoration: "none" }}
            >
              <FiDownload /> Get the app
            </a>
          ) : (
            <button
              ref={primaryRef}
              className="server-download-btn btn-primary"
              disabled
            >
              <FiDownload /> Coming soon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}