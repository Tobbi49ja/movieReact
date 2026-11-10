import { useEffect, useRef, useState } from "react";
import { FiX, FiDownload } from "react-icons/fi";
import { APP_URL } from "../utils/platform";
import { fetchAppConfig } from "../utils/appConfig";

export default function AppPromptModal({ isOpen, onClose, itemTitle }) {
  const primaryRef = useRef(null);
  const [appUrl, setAppUrl] = useState(APP_URL);

  useEffect(() => {
    fetchAppConfig().then((config) => {
      if (config?.apkUrl) setAppUrl(config.apkUrl);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => primaryRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
        onClick={(event) => event.stopPropagation()}
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
            Tap Get the app and open the downloaded file. If Android asks, allow installs from this browser. If Play Protect warns, choose Install anyway.
          </p>
        </div>

        <div className="download-modal-footer popup-actions">
          <button
            className="server-mirror-btn btn-ghost"
            onClick={onClose}
            type="button"
          >
            Not now
          </button>
          {appUrl ? (
            <a
              ref={primaryRef}
              href={appUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="server-download-btn btn-primary"
              style={{ textDecoration: "none" }}
            >
              <FiDownload /> Download now
            </a>
          ) : (
            <button
              ref={primaryRef}
              className="server-download-btn btn-primary"
              disabled
              type="button"
            >
              <FiDownload /> Download now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
