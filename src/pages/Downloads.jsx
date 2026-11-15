import { FiDownload, FiInbox, FiPause, FiPlay, FiTrash2 } from "react-icons/fi";
import { useState } from "react";
import SEOHelmet from "../components/seo/SEOHelmet";
import useDownloads from "../hooks/useDownloads";
import { pause, resume, cancel, play } from "../lib/downloader";
import { removeDownload } from "../lib/downloads";
import { resolveSources } from "../lib/resolver";
import "../styles/downloads.css";

function formatStatus(status) {
  return String(status || "queued").replace(/(^\w)|\s+(\w)/g, (m) => m.toUpperCase());
}

function formatSpeed(bps) {
  if (!bps || bps <= 0) return "";
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

const FRIENDLY = {
  ENCRYPTED: "This stream is encrypted and cannot be downloaded.",
  LIVE: "Live streams can't be downloaded.",
  UNSUPPORTED: "This format is not supported for download.",
  NO_SPACE: "Not enough storage space.",
  NETWORK: "Network error during download.",
  MUX_FAILED: "Failed to process the downloaded file.",
  FINALIZE_UNSUPPORTED: "Unable to finalize this download format.",
  EXPIRED: "Download link expired.",
};

function friendlyError(code, fallback) {
  return FRIENDLY[code] || fallback || "Download failed.";
}

export default function DownloadsPage() {
  const downloads = useDownloads();
  const [toast, setToast] = useState("");

  const handlePlay = async (download) => {
    try {
      await play(download.path);
    } catch {
      setToast("Can't open this file");
      setTimeout(() => setToast(""), 2500);
    }
  };

  const handleTogglePause = (download) => {
    const canPause = ["queued", "downloading"].includes(download.status);
    if (canPause) pause(download.id);
    else resume(download.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this download and its files?")) return;
    try { await cancel(id); } catch {}
    removeDownload(id);
  };

  const handleRetryExpired = async (download) => {
    try {
      const result = await resolveSources({
        tmdbId: download.tmdbId,
        type: download.type || "movie",
        season: download.season,
        episode: download.episode,
      });
      const qualities = Array.isArray(result?.qualities) ? result.qualities : [];
      const quality = qualities.find((q) => (q.label || q.quality) === download.quality) || qualities[0];
      if (!quality) throw new Error("No matching quality found.");
      await resume(download.id, { quality, headers: result?.headers || {} });
    } catch (e) {
      alert(e?.message || "Retry failed.");
    }
  };

  return (
    <main id="main-content" className="downloads-page">
      <SEOHelmet title="Downloads - Tobbihub" description="Manage your queued and completed downloads on Tobbihub." />
      <div className="downloads-shell">
        <header className="downloads-header">
          <div className="downloads-heading-group">
            <p className="downloads-kicker">Library</p>
            <h1 className="downloads-title">Downloads</h1>
          </div>
          <div className="downloads-count">
            <FiDownload aria-hidden="true" />
            <span>{downloads.length} item{downloads.length === 1 ? "" : "s"}</span>
          </div>
        </header>

        {downloads.length === 0 ? (
          <div className="downloads-empty">
            <div className="downloads-empty-icon"><FiInbox aria-hidden="true" /></div>
            <h2>No downloads yet</h2>
            <p>Start a download from a movie or show, and it will show up here with progress and status.</p>
          </div>
        ) : (
          <div className="downloads-grid">
            {downloads.map((download) => {
              const progress = Math.min(Math.max(Number(download.progress) || 0, 0), 100);
              const canPause = ["queued", "downloading"].includes(download.status);
              const isDownloading = download.status === "downloading";
              const isPaused = download.status === "paused";
              const isActive = isDownloading || isPaused;
              const speed = formatSpeed(download.speedBps);

              return (
                <article key={download.id} className={`downloads-card ${download.status}`}>
                  <div className="downloads-card-poster">
                    {download.poster ? (
                      <img src={download.poster} alt={download.title || "Download poster"} />
                    ) : (
                      <div className="downloads-poster-fallback">
                        <span>{download.title?.slice(0, 2).toUpperCase() || "DL"}</span>
                      </div>
                    )}
                    <div className="downloads-card-overlay">
                      {isActive && (
                        <button
                          type="button"
                          className="downloads-overlay-btn"
                          onClick={() => handleTogglePause(download)}
                          aria-label={canPause ? "Pause download" : "Resume download"}
                        >
                          {canPause ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
                        </button>
                      )}
                      {download.status === "done" && (
                        <button type="button" className="downloads-overlay-btn play" onClick={() => handlePlay(download)} aria-label="Play download">
                          <FiPlay aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="downloads-overlay-btn delete"
                        onClick={() => handleDelete(download.id)}
                        aria-label="Delete download"
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    </div>
                    {isActive && (
                      <div className="downloads-card-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="downloads-card-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="downloads-card-info">
                    <h3 className="downloads-card-title">{download.title || "Untitled download"}</h3>
                    <div className="downloads-card-meta">
                      <span className="downloads-card-quality">
                        {download.quality || "1080p"}
                        {download.size ? ` • ${download.size}` : ""}
                      </span>
                      <span className={`downloads-card-status ${download.status}`}>
                        {formatStatus(download.status)}
                      </span>
                    </div>
                    {isActive && (
                      <div className="downloads-card-speed">
                        {speed && <span>{speed}</span>}
                        <span>{progress}%</span>
                      </div>
                    )}
                    {download.status === "failed" && (
                      <div className="downloads-card-error">
                        {friendlyError(download.errorCode, download.error || download.message)}
                        {download.errorCode === "EXPIRED" && (
                          <button type="button" className="downloads-retry-btn" onClick={() => handleRetryExpired(download)}>Retry</button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {toast && <div className="downloads-toast" role="status">{toast}</div>}
    </main>
  );
}