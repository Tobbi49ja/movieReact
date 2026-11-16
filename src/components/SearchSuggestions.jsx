import { useEffect, useState } from "react";
import "../styles/search-suggestions.css";

export default function SearchSuggestions({ query, recents = [], results = [], loading, onPick, onPickRecent, onRemoveRecent, onClearRecents }) {
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [queryValue, setQueryValue] = useState(query || "");

  useEffect(() => {
    setQueryValue(query || "");
  }, [query]);

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

  const isEmptyQuery = !queryValue || queryValue.trim().length === 0;

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
                className="sugg-row"
                role="option"
                aria-selected={hoverIndex === index}
                onMouseDown={(e) => handlePickRecent(e, text)}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(-1)}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 50%, background: "#1e293b", color: "#94a3b8", fontSize: 11, flexShrink: 0 }}>
                  ⟳
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {text}
                </span>
                <button className="sugg-remove" type="button" aria-label={`Remove "${text}"`} onClick={(e) => handleRemoveRecent(e, text)}>
                  ×
                </button>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          {loading && results.length === 0 ? (
            [0, 1, 2, 3].map((i) => (
              <div key={`skeleton-${i}`} className="skeleton-row">
                <div className="skeleton-thumb" />
                <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <div className="skeleton-line long" />
                  <div className="skeleton-line meta" />
                </div>
              </div>
            ))
          ) : (
            results.map((item, index) => (
              <div
                key={item.id || index}
                className="sugg-row"
                role="option"
                aria-selected={hoverIndex === index}
                onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(-1)}
              >
                <div className="sugg-thumb">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                  ) : (
                    <div className="sugg-thumb-placeholder">🎬</div>
                  )}
                </div>
                <div className="sugg-info">
                  <div className="sugg-title-row" title={item.title}>
                    {item.title}
                  </div>
                  <div className="sugg-meta">
                    <span className="sugg-chip">{item.mediaType === "tv" ? "TV" : "Movie"}</span>
                    <span>{item.year || "—"}</span>
                    <span>★ {item.rating?.toFixed(1) ?? "—"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
          <div
            className="sugg-see-all"
            role="option"
            onMouseDown={(e) => { e.preventDefault(); onPickRecent(queryValue); }}
            onMouseEnter={() => setHoverIndex(results.length)}
            onMouseLeave={() => setHoverIndex(-1)}
          >
            See all results for “{queryValue}”
          </div>
        </>
      )}
    </div>
  );
}
