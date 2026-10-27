// src/components/DownloadModal.jsx
import { useState } from "react";
import { FiX, FiDownload, FiFilm, FiServer } from "react-icons/fi";
import toast from "react-hot-toast";

export default function DownloadModal({
  isOpen,
  onClose,
  itemTitle,
  type = "movie",
  tmdbId,
  season = 1,
  episode = 1,
}) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  if (!isOpen) return null;

  const isTv = type === "tv";

  // Download source targets — opens in new tab
  const downloadServers = [
    {
      name: "VidSrc Direct",
      badge: "1080p HD",
      quality: "1080p Full HD",
      speed: "Fast",
      externalUrl: isTv
        ? `https://vsembed.su/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vsembed.su/embed/movie/${tmdbId}`,
    },
    {
      name: "Vidnest Mirror",
      badge: "Multi Quality",
      quality: "1080p / 720p",
      speed: "Stable",
      externalUrl: isTv
        ? `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`
        : `https://vidnest.fun/movie/${tmdbId}`,
    },
    {
      name: "Aether Stream",
      badge: "Multi Lang",
      quality: "1080p",
      speed: "High Speed",
      externalUrl: isTv
        ? `https://aether.ist/media/tmdb-tv-${tmdbId}/${season}/${episode}`
        : `https://aether.ist/media/tmdb-movie-${tmdbId}`,
    },
    {
      name: "Vidrift Player",
      badge: "Standard",
      quality: "720p / 1080p",
      speed: "Standard",
      externalUrl: isTv
        ? `https://embed.vidrift.net/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://embed.vidrift.net/embed/movie/${tmdbId}`,
    },
  ];

  const handleStartDownload = (server, index) => {
    setDownloadingIdx(index);
    window.open(server.externalUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setDownloadingIdx(null), 2000);
    toast.success(`Opening ${server.name}...`);
  };

  return (
    <div className="download-modal-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div className="download-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="download-modal-header">
          <div className="download-title-group">
            <FiFilm className="modal-header-icon" />
            <div>
              <h3>Download Movie / TV Show</h3>
              <p className="download-subtitle">
                {itemTitle}
                {isTv && (
                  <span className="tv-download-tag">
                    {" "}• Season {season} Episode {episode}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button className="download-modal-close" onClick={onClose} aria-label="Close modal">
            <FiX />
          </button>
        </div>

        {/* Quality Badges */}
        <div className="download-qualities-bar">
          <span className="quality-pill q-1080">1080p Full HD</span>
          <span className="quality-pill q-720">720p HD</span>
          <span className="quality-pill q-480">480p SD</span>
          <span className="quality-pill q-multi">Multi Source Available</span>
        </div>

        {/* Server List */}
        <div className="download-servers-list">
          {downloadServers.map((server, idx) => (
            <div key={idx} className="download-server-card">
              <div className="server-info">
                <div className="server-name-row">
                  <FiServer className="server-icon" />
                  <span className="server-name">{server.name}</span>
                  <span className="server-badge">{server.badge}</span>
                </div>
                <div className="server-details">
                  <span>Quality: {server.quality}</span>
                  <span className="bullet">•</span>
                  <span>Speed: {server.speed}</span>
                </div>
              </div>

              <div className="server-actions">
                <button
                  className="server-download-btn"
                  onClick={() => handleStartDownload(server, idx)}
                  disabled={downloadingIdx === idx}
                >
                  <FiDownload /> {downloadingIdx === idx ? "Opening..." : "Watch & Download"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Instructions footer */}
        <div className="download-modal-footer">
          <p className="download-tip">
            💡 <strong>TobbiHub Tip:</strong> Click any server above — 
            it opens in a new tab. Use 
            <strong> Video DownloadHelper</strong> browser extension 
            for one-click downloads, or right-click the video → 
            "Save video as" as a fallback.
          </p>
        </div>
      </div>
    </div>
  );
}
