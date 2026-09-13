// src/components/DownloadModal.jsx
import { useState } from "react";
import { FiX, FiDownload, FiCopy, FiCheck, FiFilm, FiServer, FiExternalLink } from "react-icons/fi";
import toast from "react-hot-toast";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "https://moviereact-zzye.onrender.com");

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
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  if (!isOpen) return null;

  const isTv = type === "tv";
  const formattedTitle = isTv
    ? `${itemTitle || "Show"}_S${season}E${episode}`
    : itemTitle || "Movie";

  const cleanFilename = formattedTitle
    .replace(/[^a-zA-Z0-9_\-\. ]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  // Server targets pointing to Express proxy and fallback mirrors
  const downloadServers = [
    {
      name: "Tobbihub Direct Proxy",
      badge: "Direct MP4 Download",
      quality: "1080p Full HD",
      speed: "Ultra Fast",
      sourceKey: "vidsrc",
      proxyUrl: `${BACKEND_URL}/api/download/stream?tmdb=${tmdbId}&type=${type}&s=${season}&e=${episode}&source=vidsrc&filename=${encodeURIComponent(cleanFilename)}`,
      externalUrl: isTv
        ? `https://vidsrc.me/download/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
        : `https://vidsrc.me/download/movie?tmdb=${tmdbId}`,
    },
    {
      name: "AutoEmbed HD Gateway",
      badge: "720p / 1080p",
      quality: "720p / 1080p",
      speed: "High Speed",
      sourceKey: "2embed",
      proxyUrl: `${BACKEND_URL}/api/download/stream?tmdb=${tmdbId}&type=${type}&s=${season}&e=${episode}&source=2embed&filename=${encodeURIComponent(cleanFilename)}`,
      externalUrl: isTv
        ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${tmdbId}`,
    },
    {
      name: "MultiEmbed Mirror",
      badge: "Multi-Quality",
      quality: "1080p / 720p / 480p",
      speed: "Stable",
      sourceKey: "multiembed",
      proxyUrl: `${BACKEND_URL}/api/download/stream?tmdb=${tmdbId}&type=${type}&s=${season}&e=${episode}&source=multiembed&filename=${encodeURIComponent(cleanFilename)}`,
      externalUrl: isTv
        ? `https://multiembed.mov/direct-download?tmdb=${tmdbId}&s=${season}&e=${episode}`
        : `https://multiembed.mov/direct-download?tmdb=${tmdbId}`,
    },
    {
      name: "VidSrc Pro Direct",
      badge: "Standard Mirror",
      quality: "720p HD",
      speed: "Standard",
      sourceKey: "vidsrcpro",
      proxyUrl: `${BACKEND_URL}/api/download/stream?tmdb=${tmdbId}&type=${type}&s=${season}&e=${episode}&source=vidsrcpro&filename=${encodeURIComponent(cleanFilename)}`,
      externalUrl: isTv
        ? `https://vidsrc.pro/embed/tv/${tmdbId}?season=${season}&episode=${episode}`
        : `https://vidsrc.pro/embed/movie/${tmdbId}`,
    },
  ];

  const handleStartDownload = (server, index) => {
    setDownloadingIdx(index);
    toast.success(`Starting download for ${formattedTitle}...`);

    // Create an invisible anchor tag to trigger direct download prompt
    const a = document.createElement("a");
    a.href = server.proxyUrl;
    a.download = `${cleanFilename}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingIdx(null);
    }, 60000);
  };

  const handleCopyLink = (url, index) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    toast.success("Download link copied to clipboard! (Paste into IDM/1DM/ADM)");
    setTimeout(() => setCopiedIndex(null), 2500);
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
          <span className="quality-pill q-multi">Proxy Downloader Active</span>
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
                  <FiDownload /> {downloadingIdx === idx ? "Starting..." : "Download MP4"}
                </button>

                <a
                  href={server.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="server-mirror-btn"
                  title="Open External Mirror"
                >
                  <FiExternalLink />
                </a>

                <button
                  className="server-copy-btn"
                  onClick={() => handleCopyLink(server.proxyUrl, idx)}
                  title="Copy Direct Link for Download Manager"
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
            💡 <strong>MovieBox Tip:</strong> Click <strong>"Download MP4"</strong> to trigger direct binary downloading via Tobbihub's proxy server. For 3rd-party download apps (like IDM, 1DM, ADM), click the copy icon to copy the direct link.
          </p>
          <p className="download-note">
            ⏱️ First download may take 15–30s while the stream resolves. Subsequent downloads are instant (cached for 30 min).
          </p>
        </div>
      </div>
    </div>
  );
}
