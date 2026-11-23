import { useEffect, useState } from "react";
import "../styles/search-suggestions.css";

export default function SearchSuggestions({
  query,
  recents = [],
  results = [],
  loading,
  clean = "",
  year = "",
  onPick,
  onPickRecent,
  onSearchQuery,
  onRemoveRecent,
  onClearRecents,
}) {
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [queryValue, setQueryValue] = useState(query || "");

  useEffect(() => {
    setQueryValue(query || "");
    setHoverIndex(-1);
  }, [query]);

  const trimmed = queryValue.trim();
  const isEmptyQuery = trimmed.length === 0;
  const optionCount = isEmptyQuery ? recents.length : results.length + 1;

  const handlePickRecent = (e, text) => {
    e.preventDefault();
    onPickRecent(text);
  };

  const handleRemoveRecent = (e, text) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveRecent(text);
  };

  const handleClearRecents = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClearRecents();
  };

  const runRawSearch = (e) => {
    if (e) e.preventDefault();
    onSearchQuery(queryValue);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const el = document.activeElement;
      const isSearchInput = el && el.tagName === "INPUT" && el.type === "search";
      if (!isSearchInput) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHoverIndex((i) => (i + 1 >= optionCount ? 0 : i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHoverIndex((i) => (i - 1 < 0 ? optionCount - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (!isEmptyQuery && hoverIndex >= 1) {
          const item = results[hoverIndex - 1];
          if (item) {
            e.preventDefault();
            onPick(item);
          }
        } else if (isEmptyQuery && hoverIndex >= 0) {
          const text = recents[hoverIndex];
          if (text) {
            e.preventDefault();
            onPickRecent(text);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [optionCount, hoverIndex, isEmptyQuery, results, recents, onPick, onPickRecent]);

  return (
    <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
      {isEmptyQuery ? (
        <>
          <div className="sugg-header">
            <h3 className="sugg-title">Recent searches</h3>
            {recents.length > 0 && (
              <button className="sugg-link" type="button" onClick={handleClearRecents} aria-label="Clear all recent searches">
                Clear all
              </button>
            )}
          </div>
          {recents.length === 0 ? (
            <div className="sugg-empty">No recent searches</div>
          ) : (
            recents.map((text, index) => (
              <div
                key={`${index}-${text}`}
                className={`sugg-row${hoverIndex === index ? " active" : ""}`}
                role="option"
                aria-selected={hoverIndex === index}
                onMouseDown={(e) => handlePickRecent(e, text)}
                onMouseEnter={() => setHoverIndex(index)}
              >
                <span className="sugg-ico">⟳</span>
                <span className="sugg-title-text">{text}</span>
                <button className="sugg-remove" type="button" aria-label={`Remove "${text}"`} onClick={(e) => handleRemoveRecent(e, text)}>
                  ×
                </button>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <div
            className={`sugg-row sugg-raw${hoverIndex === 0 ? " active" : ""}`}
            role="option"
            aria-selected={hoverIndex === 0}
            onMouseDown={runRawSearch}
            onMouseEnter={() => setHoverIndex(0)}
          >
            <span className="sugg-ico">🔍</span>
            <span className="sugg-title-text">{queryValue}</span>
            {year && <span className="sugg-year">{year}</span>}
          </div>

          {loading && results.length === 0 ? (
            [0, 1, 2, 3].map((i) => (
              <div key={`skeleton-${i}`} className="skeleton-row">
                <div className="skeleton-line long" />
                <div className="skeleton-line meta" />
              </div>
            ))
          ) : (
            results.map((item, index) => (
              <div
                key={item.id || index}
                className={`sugg-row${hoverIndex === index + 1 ? " active" : ""}`}
                role="option"
                aria-selected={hoverIndex === index + 1}
                onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
                onMouseEnter={() => setHoverIndex(index + 1)}
              >
                <span className="sugg-title-text" title={item.title}>{item.title}</span>
                <span className="sugg-right">
                  <span className="sugg-badge">{item.mediaType === "tv" ? "TV" : "Movie"}</span>
                  {item.year && <span className="sugg-year">{item.year}</span>}
                </span>
              </div>
            ))
          )}

          {!loading && results.length === 0 && (
            <div className="sugg-empty">No results for “{clean || queryValue}”</div>
          )}
        </>
      )}
    </div>
  );
}
