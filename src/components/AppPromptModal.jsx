// src/components/AppPromptModal.jsx
import { useEffect, useRef, useState } from "react";
import { FiX, FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isNativeApp, APP_URL } from "../utils/platform";
import { fetchAppConfig } from "../utils/appConfig";
import { startDownload as startServerDownload, listDownloads, deleteDownload, clearDownloads } from "../utils/downloads";
import { addDownload, updateDownload } from "../lib/downloads";
import { onStreamFound, getFound } from "../lib/mediaSniffer";
import { startDownload as startNativeDownload } from "../lib/downloadEngine";

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

function isLikelyDirectMediaUrl(value) {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  if (!candidate) return false;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const pathname = parsed.pathname.toLowerCase();
    return pathname.includes('.m3u8') || pathname.includes('.mp4') || pathname.includes('.mkv') || pathname.includes('.webm') || pathname.includes('.mov') || pathname.includes('.avi') || pathname.includes('.flv') || pathname.includes('.m4v') || pathname.includes('.mpd');
  } catch {
    return false;
  }
}

export default function AppPromptModal({ isOpen, onClose, itemTitle, sourceId, sourceLabel, sourceUrl, foundStreamsRef }) {
  const primaryRef = useRef(null);
  const providerId = String(sourceId || "").trim().toLowerCase();
  const providerLabel = sourceLabel || "this source";
  const resolvedSourceUrl = String(sourceUrl || "").trim();
  const [appUrl, setAppUrl] = useState(APP_URL);
  const [streamUrl, setStreamUrl] = useState("");
  const inputUrl = (streamUrl || resolvedSourceUrl || "").trim();
  const hasDirectUrlCandidate = isLikelyDirectMediaUrl(inputUrl);
  const [downloadJobs, setDownloadJobs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [quality, setQuality] = useState("best");
  const [nativeQuality, setNativeQuality] = useState("720p");
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

  const handleSubtitleToggle = (language) => {
    setSubtitlePrefs((prev) => {
      if (prev.includes(language)) {
        return prev.filter((item) => item !== language);
      }
      return [...prev, language];
    });
  };

  const normalizeFoundStreams = (items) => {
    if (!Array.isArray(items)) return [];
    const normalized = items
      .map((item) => {
        const url = typeof item?.url === "string" ? item.url.trim() : "";
        const type = typeof item?.type === "string" ? item.type.toLowerCase() : "";
        if (!url || !["mp4", "hls"].includes(type)) return null;
        return {
          url,
          type,
          headers: item?.headers && typeof item.headers === "object" ? item.headers : {},
        };
      })
      .filter(Boolean);

    const deduped = new Map();
    for (const item of normalized) {
      if (!deduped.has(item.url)) deduped.set(item.url, item);
    }
    return [...deduped.values()];
  };

  const selectBestStream = (items) => {
    const normalized = normalizeFoundStreams(items);
    if (!normalized.length) return null;

    const mp4 = normalized.filter((item) => item.type === "mp4");
    if (mp4.length > 0) {
      return [...mp4].sort((a, b) => b.url.length - a.url.length)[0];
    }

    const hls = normalized.filter((item) => item.type === "hls");
    if (!hls.length) return null;

    return [...hls].sort((a, b) => {
      const aMaster = /master|playlist/i.test(a.url) ? 1 : 0;
      const bMaster = /master|playlist/i.test(b.url) ? 1 : 0;
      if (aMaster !== bMaster) return bMaster - aMaster;
      return b.url.length - a.url.length;
    })[0];
  };

  const handleNativeQueue = async () => {
    if (!isNativeApp() || isSubmitting) return;

    const toastId = "native-download-toast";
    const queued = addDownload({
      tmdbId: sourceId || null,
      type: "movie",
      title: itemTitle || "Download",
      poster: "",
      quality: nativeQuality,
      status: "queued",
      progress: 0,
      path: "",
      size: "",
      createdAt: new Date().toISOString(),
    });

    setIsSubmitting(true);
    setDownloadError("");

    try {
      const initialFound = normalizeFoundStreams(foundStreamsRef?.current || []);
      const liveFound = normalizeFoundStreams(await getFound());
      const foundStreams = normalizeFoundStreams([...initialFound, ...liveFound]);
      if (foundStreamsRef) foundStreamsRef.current = foundStreams;

      let selectedStream = selectBestStream(foundStreams);

      if (!selectedStream) {
        toast("Detecting stream, press play and wait...", { id: toastId });

        const waitForStream = await new Promise((resolve) => {
          const startedAt = Date.now();
          let settled = false;
          let detach = () => {};

          const complete = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            detach();
            resolve(value);
          };

          detach = onStreamFound((event) => {
            const candidate = normalizeFoundStreams([event])[0];
            if (!candidate) return;
            if (foundStreamsRef) foundStreamsRef.current = normalizeFoundStreams([...foundStreamsRef.current, candidate]);
            const next = selectBestStream(foundStreamsRef.current || [candidate]);
            if (!next) return;
            complete(next);
          });

          const timeoutId = setTimeout(() => {
            complete(null);
          }, 30000);

          const checkExisting = () => {
            const latest = selectBestStream(foundStreamsRef?.current || []);
            if (latest && !settled) {
              complete(latest);
              return;
            }
            if (Date.now() - startedAt < 30000 && !settled) {
              setTimeout(checkExisting, 250);
            }
          };
          checkExisting();
        });

        selectedStream = waitForStream;
      }

      if (!selectedStream) {
        updateDownload(queued.id, {
          status: "failed",
          message: "No stream detected. Press play on the player first, then try again.",
        });
        toast.error("No stream detected. Press play on the player first, then try again.", { id: toastId });
        setDownloadError("No stream detected. Press play on the player first, then try again.");
        return;
      }

      const host = (() => {
        try {
          return new URL(selectedStream.url).hostname;
        } catch {
          return "unknown host";
        }
      })();

      toast.success(`Found ${selectedStream.type} stream from ${host}`, { id: toastId });

      if (selectedStream.type === "hls") {
        updateDownload(queued.id, {
          status: "failed",
          message: "HLS not supported yet",
        });
        setDownloadError("HLS not supported yet");
        toast.error("HLS not supported yet", { id: toastId });
        return;
      }

      await startNativeDownload(queued.id, {
        url: selectedStream.url,
        headers: selectedStream.headers || {},
      });

      toast.success(`Downloaded: ${queued.title} (${queued.quality})`, { id: toastId });
      setDownloadError("");
      onClose?.();
    } catch (error) {
      const message = error?.message || "Unable to download this stream.";
      updateDownload(queued.id, {
        status: "failed",
        message,
      });
      setDownloadError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
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
    const requestUrl = (streamUrl || resolvedSourceUrl || "").trim();
    if (!requestUrl) {
      setDownloadError("Paste a valid http or https stream URL first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setDownloadError("");

      const parsed = new URL(requestUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error("Only http and https sources are supported.");
      }

      const isDirectMedia = isLikelyDirectMediaUrl(requestUrl);

      if (!isDirectMedia) {
        throw new Error("This source is not a valid direct media URL. Paste a real .mp4/.m3u8 stream URL from a supported provider.");
      }

      if (isNativeApp() && isDirectMedia) {
        await handleNativeDownload();
        return;
      }

      const payload = {
        m3u8Url: requestUrl,
        title: itemTitle || "Tobbihub download",
        downloadPath: "downloads",
        mediaType: "movie",
        quality,
        subtitles: subtitlePrefs,
        provider: providerId || "manual",
      };

      const created = await startServerDownload(payload);
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
            Direct downloads work only for trusted stream URLs. Some embedded providers hide the real media link,
            so the app will only download when the URL is valid and the source is supported.
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

          {isNativeApp() && (
            <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "0.9rem" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Native download</div>
              <label htmlFor="native-download-quality" style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
                Quality
              </label>
              <select
                id="native-download-quality"
                value={nativeQuality}
                onChange={(e) => setNativeQuality(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,10,10,0.45)", color: "#fff" }}
              >
                <option value="360p">360p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>

              <button
                type="button"
                onClick={handleNativeQueue}
                className="server-download-btn btn-primary"
                disabled={isSubmitting}
                style={{ marginTop: "0.8rem", width: "100%" }}
              >
                <FiDownload /> {isSubmitting ? "Working..." : "Start"}
              </button>
            </div>
          )}

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