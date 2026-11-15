import "../styles/livetv.css";
import { useState, useEffect, useRef, useMemo } from "react";
import SEOHelmet from "../components/seo/SEOHelmet";
import useSearchHistory from "../hooks/useSearchHistory";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "https://moviereact-zzye.onrender.com";

const CATEGORY_ICONS = {
  sports: "⚽",
  kids: "🧒",
  news: "📰",
  documentary: "🎥",
  entertainment: "🎭",
  nigerian: "🇳🇬",
};

export default function LiveTV() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("sports");
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeChannel, setActiveChannel] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const searchWrapRef = useRef(null);
  const { items: recentItems, add: addRecent, remove: removeRecent, clear: clearRecent } = useSearchHistory("tobbihub_livetv_recent");

  // Fetch category list once on mount
  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/livetv/categories`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCategories(data.categories || []);
      } catch (err) {
        console.error("Failed to load Live TV categories:", err.message);
        if (!cancelled) setCategories(Object.keys(CATEGORY_ICONS));
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset pagination when the category changes
  useEffect(() => {
    setPage(1);
  }, [activeCategory]);

  // Fetch channels for category + page (append when paging, replace on category change)
  useEffect(() => {
    let cancelled = false;

    const fetchChannels = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/livetv/channels?category=${activeCategory}&page=${page}&limit=24`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTotal(data.total || 0);
        setChannels((prev) => (page === 1 ? data.channels || [] : [...prev, ...(data.channels || [])]));
      } catch (err) {
        console.error("Failed to load Live TV channels:", err.message);
        if (!cancelled) {
          setChannels([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchChannels();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, page]);

  // Search across all categories
  useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      const q = searchTerm.trim();
      if (!q) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/livetv/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setChannels(data.channels || []);
          setTotal(0);
          setLoading(false);
        }
      } catch (err) {
        console.error("Live TV search failed:", err.message);
        if (!cancelled) setChannels([]);
      }
    };

    runSearch();
    return () => {
      cancelled = true;
    };
  }, [searchTerm]);

  const visibleChannels = searchTerm.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : channels;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const onDoc = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = debouncedTerm.trim().toLowerCase();
    if (!q) return { recents: recentItems.slice(0, 8), names: [] };
    const recents = recentItems.filter((r) => r.toLowerCase().includes(q)).slice(0, 5);
    const seen = new Set(recents.map((r) => r.toLowerCase()));
    const names = [];
    for (const ch of channels) {
      const n = ch?.name || "";
      const ln = n.toLowerCase();
      if (!ln.includes(q) || seen.has(ln)) continue;
      seen.add(ln);
      names.push(n);
      if (names.length >= 5) break;
    }
    return { recents, names };
  }, [debouncedTerm, recentItems, channels]);

  const showDropdown = searchOpen && (searchTerm.trim() === "" ? recentItems.length > 0 : (suggestions.recents.length + suggestions.names.length) > 0);

  const commitSearch = (q) => {
    const v = String(q || "").trim();
    if (v.length >= 2) addRecent(v);
    setSearchTerm(v);
    setSearchOpen(false);
  };

  const pickSuggestion = (q) => {
    commitSearch(q);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSearch(searchTerm);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  return (
    <div className="livetv-page">
      <SEOHelmet
        title="Live TV - Watch Free Live Channels Online | Tobbihub"
        description="Stream free live TV channels — sports, news, kids, documentary, entertainment and Nigerian channels."
      />

      <h1 className="livetv-title">Live TV</h1>
      <p className="livetv-subtitle">Free live channels, updated daily.</p>

      {/* Search */}
      <div className="livetv-search-wrap" ref={searchWrapRef}>
        <div className="livetv-search">
          <input
            type="search"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        {showDropdown && (
          <div className="livetv-search-dropdown">
            {searchTerm.trim() === "" ? (
              <>
                <div className="livetv-search-header">
                  <span>Recent searches</span>
                  <button type="button" className="livetv-search-clear" onMouseDown={(e) => { e.preventDefault(); clearRecent(); }}>Clear all</button>
                </div>
                {suggestions.recents.map((r) => (
                  <div key={`r-${r}`} className="livetv-search-row">
                    <button type="button" className="livetv-search-item" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(r); }}>{r}</button>
                    <button type="button" className="livetv-search-remove" aria-label={`Remove ${r}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeRecent(r); }}>×</button>
                  </div>
                ))}
              </>
            ) : (
              <>
                {suggestions.recents.length > 0 && (
                  <>
                    <div className="livetv-search-header"><span>Recent searches</span></div>
                    {suggestions.recents.map((r) => (
                      <div key={`r-${r}`} className="livetv-search-row">
                        <button type="button" className="livetv-search-item" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(r); }}>{r}</button>
                        <button type="button" className="livetv-search-remove" aria-label={`Remove ${r}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeRecent(r); }}>×</button>
                      </div>
                    ))}
                  </>
                )}
                {suggestions.names.map((n) => (
                  <div key={`n-${n}`} className="livetv-search-row">
                    <button type="button" className="livetv-search-item" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(n); }}>{n}</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Active channel player */}
      {activeChannel && (
        <div className="livetv-player-wrapper">
          <h2>{activeChannel.name}</h2>
          <video
            key={activeChannel.url}
            controls
            autoPlay
            className="livetv-video"
            onError={() => alert("Stream unavailable. Try another channel.")}
          >
            <source src={activeChannel.url} type="application/x-mpegURL" />
          </video>
          <button onClick={() => setActiveChannel(null)}>✕ Close</button>
        </div>
      )}

      {/* Category tabs */}
      <div className="livetv-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={activeCategory === cat ? "livetv-tab active" : "livetv-tab"}
            onClick={() => {
              setActiveCategory(cat);
              setPage(1);
            }}
          >
            {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Channel grid */}
      {loading ? (
        <div className="livetv-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="channel-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="livetv-grid">
          {visibleChannels.map((ch, i) => (
            <div key={`${ch.name}-${i}`} className="channel-card" onClick={() => { if (searchTerm.trim().length >= 2) addRecent(searchTerm.trim()); setActiveChannel(ch); }}>
              <img src={ch.logo} alt={ch.name} onError={(e) => (e.target.style.display = "none")} />
              <span>{ch.name}</span>
              <span className="live-badge">🔴 LIVE</span>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {!searchTerm.trim() && channels.length < total && (
        <button className="load-more-btn" onClick={() => setPage((p) => p + 1)} disabled={loading}>
          {loading ? "Loading…" : "Load More"}
        </button>
      )}
    </div>
  );
}
