import { useEffect, useRef, useState } from "react";
import "../styles/search-suggestions.css";

const MAX_SUGGESTIONS = 8;

export default function SearchSuggestions({
  query = "",
  results = [],
  loading = false,
  clean = "",
  onPickRow,
  onClose,
}) {
  const rootRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = String(query || "").trim();
  const items = Array.isArray(results) ? results.slice(0, MAX_SUGGESTIONS) : [];
  const optionCount = 1 + items.length;

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed) return;

    const handleKeyDown = (e) => {
      const el = document.activeElement;
      const isSearchInput = el && el.tagName === "INPUT" && el.type === "search";
      if (!isSearchInput) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1 >= optionCount ? 0 : i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 < 0 ? optionCount - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (activeIndex < 0) return;
        e.preventDefault();
        if (activeIndex === 0) {
          if (onPickRow) onPickRow(trimmed);
        } else {
          const item = items[activeIndex - 1];
          if (item && onPickRow) onPickRow(item.title);
        }
      } else if (e.key === "Escape") {
        if (onClose) onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [trimmed, optionCount, activeIndex, items, onPickRow, onClose]);

  useEffect(() => {
    if (!trimmed) return;

    const handleOutside = (e) => {
      const target = e.target;
      const isInput = target.tagName === "INPUT" && target.type === "search";
      if (rootRef.current && rootRef.current.contains(target)) return;
      if (isInput) return;
      if (onClose) onClose();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [trimmed, onClose]);

  if (!trimmed) return null;

  const pickRow = (e, text) => {
    e.preventDefault();
    if (onPickRow) onPickRow(text);
  };

  return (
    <div ref={rootRef} className="search-suggestions" role="listbox" aria-label="Search suggestions">
      <div
        className={`sugg-row sugg-raw${activeIndex === 0 ? " active" : ""}`}
        role="option"
        aria-selected={activeIndex === 0}
        onMouseDown={(e) => pickRow(e, trimmed)}
        onMouseEnter={() => setActiveIndex(0)}
      >
        <span className="sugg-ico">🔍</span>
        <span className="sugg-title-text">{trimmed}</span>
      </div>

      {loading && items.length === 0 ? (
        [0, 1, 2, 3].map((i) => (
          <div key={`skeleton-${i}`} className="skeleton-row">
            <div className="skeleton-line long" />
            <div className="skeleton-line meta" />
          </div>
        ))
      ) : (
        items.map((item, index) => (
          <div
            key={item.id || `${item.title}-${index}`}
            className={`sugg-row${activeIndex === index + 1 ? " active" : ""}`}
            role="option"
            aria-selected={activeIndex === index + 1}
            onMouseDown={(e) => pickRow(e, item.title)}
            onMouseEnter={() => setActiveIndex(index + 1)}
          >
            <span className="sugg-title-text" title={item.title}>{item.title}</span>
            <span className="sugg-right">
              <span className="sugg-badge">{item.mediaType === "tv" ? "TV" : "Movie"}</span>
              {item.year && <span className="sugg-year">{item.year}</span>}
            </span>
          </div>
        ))
      )}

      {!loading && items.length === 0 && (
        <div className="sugg-empty">No results for “{clean || trimmed}”</div>
      )}
    </div>
  );
}
