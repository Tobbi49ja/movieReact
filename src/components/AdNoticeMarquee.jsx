import React, { useState, useEffect, useRef } from "react";

export default function AdNoticeMarquee() {
  const [hidden, setShowHidden] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [paused, setPaused] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    const isHidden = localStorage.getItem("adNoticeHidden") === "true";
    setShowHidden(isHidden);
  }, []);

  useEffect(() => {
    if (hidden) return;

    const text = textRef.current;
    if (!text) return;

    let observer = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => {
        setPaused(!entry.isIntersecting);
      }, { threshold: 0.1 });
      observer.observe(text);
    }

    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hidden]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("adNoticeHidden", "true");
    }
    setShowHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="ad-marquee-wrapper" role="alert" aria-live="polite">
      <div className="ad-marquee-content">
        <div
          className={`ad-marquee-text${paused ? " is-paused" : ""}`}
          ref={textRef}
          data-paused={paused}
        >
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