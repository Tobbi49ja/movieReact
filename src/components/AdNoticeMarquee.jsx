import React, { useState, useEffect } from "react";

export default function AdNoticeMarquee() {
  const [hidden, setHidden] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const isHidden = localStorage.getItem("adNoticeHidden") === "true";
    setHidden(isHidden);
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("adNoticeHidden", "true");
    }
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="ad-marquee-wrapper" role="alert" aria-live="polite">
      <div className="ad-marquee-content">
        <div className="ad-marquee-text">
          <span aria-hidden="true">⚠️</span> Tip: Use an ad-blocker in your browser to block popups and enjoy
          smoother, ad-free viewing on TobbiHub.
        </div>

        <div className="ad-marquee-controls">
          <label className="ad-marquee-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              aria-label="Don't show this notice again"
            />
            <span>Don't show again</span>
          </label>
          <button onClick={handleClose} className="ad-marquee-close" aria-label="Close notice">
            <span aria-hidden="true">✖</span>
          </button>
        </div>
      </div>
    </div>
  );
}
