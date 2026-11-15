import { FiDownload, FiInbox, FiPause, FiPlay, FiTrash2 } from "react-icons/fi";
import SEOHelmet from "../components/seo/SEOHelmet";
import useDownloads from "../hooks/useDownloads";
import { pause, resume, cancel } from "../lib/downloader";
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

function formatEta(sec) {
  if (!sec || sec <= 0 || !isFinite(sec)) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
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
          <div className="downloads-list">
            {downloads.map((download) => {
              const progress = Math.min(Math.max(Number(download.progress) || 0, 0), 100);
              const canPause = ["queued", "downloading"].includes(download.status);
              const isDownloading = download.status === "downloading";
              const statusClass = String(download.status || "queued").toLowerCase();
              const speed = formatSpeed(download.speedBps);
              const eta = formatEta(download.etaSec);

              return (
                <article key={download.id} className="downloads-item">
                  <div className="downloads-thumb" aria-hidden="true">
                    {download.poster ? (
                      <img src={download.poster} alt={download.title || "Download poster"} />
                    ) : (
                      <div className="downloads-thumb-fallback">{download.title?.slice(0, 2).toUpperCase() || "DL"}</div>
                    )}
                  </div>

                  <div className="downloads-main">
                    <div className="downloads-main-top">
                      <div className="downloads-meta">
                        <h3 className="downloads-title-text">{download.title || "Untitled download"}</h3>
                        <p className="downloads-subtitle">
                          {download.quality || "1080p"}
                          {download.size ? ` • ${download.size}` : ""}
                          {download.type ? ` • ${download.type}` : ""}
                          {download.season ? ` • S${download.season}` : ""}
                          {download.episode ? `E${download.episode}` : ""}
                        </p>
                      </div>
                      <div className={`downloads-status ${statusClass}`}>{formatStatus(download.status)}</div>
                    </div>

                    <div className="downloads-progress-wrap">
                      <div className="downloads-progress-label">
                        <span>{isDownloading && (speed || eta) ? [speed, eta].filter(Boolean).join(" • ") : "Progress"}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="downloads-progress-bar" aria-label="Download progress">
                        <span className="downloads-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {download.status === "failed" && (
                      <div className="downloads-error">
                        {friendlyError(download.errorCode, download.error || download.message)}
                        {download.errorCode === "EXPIRED" && (
                          <button type="button" className="downloads-retry-btn" onClick={() => handleRetryExpired(download)}>Retry</button>
                        )}
                      </div>
                    )}

                    {download.status === "done" && (
                      <button type="button" className="downloads-play-btn" disabled>Offline player coming next</button>
                    )}
                  </div>

                  <div className="downloads-actions" aria-label="Download actions">
                    {download.status !== "done" && download.status !== "failed" && (
                      <button type="button" onClick={() => handleTogglePause(download)} className="downloads-action-btn" aria-label={canPause ? "Pause download" : "Resume download"}>
                        {canPause ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(download.id)} className="downloads-action-btn delete" aria-label="Delete download">
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
