// src/components/DownloadModal.jsx
import { useState } from "react";
import { FiX, FiDownload, FiCopy, FiCheck, FiFilm, FiServer } from "react-icons/fi";
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
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!isOpen) return null;

  const isTv = type === "tv";

  // MovieBox style download mirrors & links
  const downloadServers = [
    {
      name: "VidSrc VIP Mirror",
      badge: "Fast 1080p",
      quality: "1080p Full HD",
      speed: "Ultra Fast",
      url: isTv
        ? `https://vidsrc.me/download/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://vidsrc.me/download/movie?tmdb=${tmdbId}`,
      directUrl: isTv
        ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
    },
    {
      name: "AutoEmbed Server",
      badge: "HD 720p/1080p",
      quality: "720p / 1080p",
      speed: "High Speed",
      url: isTv
        ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${tmdbId}`,
      directUrl: isTv
        ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${tmdbId}`,
    },
    {
      name: "MultiEmbed Gateway",
      badge: "Multi Quality",
      quality: "1080p / 720p / 480p",
      speed: "Stable",
      url: isTv
        ? `https://multiembed.mov/direct-download?tmdb=${tmdbId}&s=${season}&e=${episode}`
        : `https://multiembed.mov/direct-download?tmdb=${tmdbId}`,
      directUrl: isTv
        ? `https://vidsrc.pro/embed/tv/${tmdbId}?season=${season}&episode=${episode}`
        : `https://vidsrc.pro/embed/movie/${tmdbId}`,
    },
    {
      name: "VidSrc Pro Direct",
      badge: "Direct Stream",
      quality: "720p HD",
      speed: "Standard",
      url: isTv
        ? `https://vidsrc.pro/embed/tv/${tmdbId}?season=${season}&episode=${episode}`
        : `https://vidsrc.pro/embed/movie/${tmdbId}`,
      directUrl: isTv
        ? `https://vidsrc.pro/embed/tv/${tmdbId}?season=${season}&episode=${episode}`
        : `https://vidsrc.pro/embed/movie/${tmdbId}`,
    },
  ];

  const handleCopyLink = (url, index) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    toast.success("Download link copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="download-modal-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="download-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="download-modal-header">
          <div className="download-title-group">
            <FiFilm className="modal-header-icon" />
            <div>
              <h3>Download Options</h3>
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
          <span className="quality-pill q-multi">Multi-Audio / Subtitles</span>
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
                <a
                  href={server.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="server-download-btn"
                >
                  <FiDownload /> Download
                </a>
                <button
                  className="server-copy-btn"
                  onClick={() => handleCopyLink(server.url, idx)}
                  title="Copy Download Link"
                >
                  {copiedIndex === idx ? <FiCheck className="copied-icon" /> : <FiCopy />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Instructions footer */}
        <div className="download-modal-footer">
          <p className="download-tip">
            💡 <strong>MovieBox Tip:</strong> If clicking "Download" opens a player window, right-click (or long-press on mobile) inside the video container and select <em>"Save Video As..."</em> to start downloading directly.
          </p>
        </div>
      </div>
    </div>
  );
}
