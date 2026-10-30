// src/components/AppPromptModal.jsx
import { useEffect, useRef, useState } from "react";
import { FiX, FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";
import { isNativeApp, APP_URL } from "../utils/platform";
import { fetchAppConfig } from "../utils/appConfig";

export default function AppPromptModal({ isOpen, onClose, itemTitle }) {
  const [appUrl, setAppUrl] = useState(APP_URL);
  useEffect(() => {
    fetchAppConfig().then((c) => { if (c?.apkUrl) setAppUrl(c.apkUrl); });
  }, []);
  if (isNativeApp()) return null;

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

  const onNativeDownload = () => {
    toast("Coming soon");
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

        <div className="app-prompt-body">
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
        </div>

        <div className="download-modal-footer" style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {isNativeApp() ? (
            <button
              ref={primaryRef}
              className="server-download-btn"
              onClick={onNativeDownload}
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
              className="server-download-btn"
              style={{ textDecoration: "none" }}
            >
              <FiDownload /> Get the app
            </a>
          ) : (
            <button
              ref={primaryRef}
              className="server-download-btn"
              disabled
            >
              <FiDownload /> Coming soon
            </button>
          )}
          <button
            className="server-mirror-btn"
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}