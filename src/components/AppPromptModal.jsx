// src/components/AppPromptModal.jsx
import { useEffect, useRef } from "react";
import { FiX, FiDownload } from "react-icons/fi";
import toast from "react-hot-toast";
import { isNativeApp, APP_URL } from "../utils/platform";

export default function AppPromptModal({ isOpen, onClose, itemTitle }) {
  const primaryRef = useRef(null);

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

  const hasAppUrl = !!APP_URL;

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
              href={APP_URL}
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