import { FiDownload, FiInbox, FiPause, FiPlay, FiTrash2 } from "react-icons/fi";
import SEOHelmet from "../components/seo/SEOHelmet";
import useDownloads from "../hooks/useDownloads";
import { pauseDownload, resumeDownload } from "../lib/downloadEngine";
import { removeDownload } from "../lib/downloads";
import "../styles/downloads.css";

function formatStatus(status) {
  return String(status || "queued").replace(/(^\w)|\s+(\w)/g, (match) => match.toUpperCase());
}

export default function DownloadsPage() {
  const downloads = useDownloads();

  const handleTogglePause = (download) => {
    const shouldPause = ["queued", "downloading"].includes(download.status);
    if (shouldPause) {
      pauseDownload(download.id);
    } else {
      resumeDownload(download.id);
    }
  };

  return (
    <main id="main-content" className="downloads-page">
      <SEOHelmet
        title="Downloads - Tobbihub"
        description="Manage your queued and completed downloads on Tobbihub."
      />

      <div className="downloads-shell">
        <header className="downloads-header">
          <div className="downloads-heading-group">
            <p className="downloads-kicker">Library</p>
            <h1 className="downloads-title">Downloads</h1>
          </div>
          <div className="downloads-count">
            <FiDownload aria-hidden="true" />
            <span>
              {downloads.length} item{downloads.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        {downloads.length === 0 ? (
          <div className="downloads-empty">
            <div className="downloads-empty-icon">
              <FiInbox aria-hidden="true" />
            </div>
            <h2>No downloads yet</h2>
            <p>
              Start a download from a movie or show, and it will show up here with progress and status.
            </p>
          </div>
        ) : (
          <div className="downloads-list">
            {downloads.map((download) => {
              const progress = Math.min(Math.max(Number(download.progress) || 0, 0), 100);
              const canPause = ["queued", "downloading"].includes(download.status);
              const statusClass = String(download.status || "queued").toLowerCase();

              return (
                <article key={download.id} className="downloads-item">
                  <div className="downloads-thumb" aria-hidden="true">
                    {download.poster ? (
                      <img src={download.poster} alt={download.title || "Download poster"} />
                    ) : (
                      <div className="downloads-thumb-fallback">
                        {download.title?.slice(0, 2).toUpperCase() || "DL"}
                      </div>
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

                      <div className={`downloads-status ${statusClass}`}>
                        {formatStatus(download.status)}
                      </div>
                    </div>

                    <div className="downloads-progress-wrap">
                      <div className="downloads-progress-label">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="downloads-progress-bar" aria-label="Download progress">
                        <span className="downloads-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {download.status === "failed" && download.message && (
                      <div className="downloads-error">{download.message}</div>
                    )}
                  </div>

                  <div className="downloads-actions" aria-label="Download actions">
                    <button
                      type="button"
                      onClick={() => handleTogglePause(download)}
                      className="downloads-action-btn"
                      aria-label={canPause ? "Pause download" : "Resume download"}
                    >
                      {canPause ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeDownload(download.id)}
                      className="downloads-action-btn delete"
                      aria-label="Delete download"
                    >
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
