import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import SEOHelmet from "../components/seo/SEOHelmet";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

const FILTERS = ["All", "Movies", "TV Shows"];

export default function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState(location.state?.query || "");
  const [inputValue, setInputValue] = useState(location.state?.query || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const inputRef = useRef(null);

  // Re-run search when query changes
  useEffect(() => {
    if (location.state?.query) {
      setQuery(location.state.query);
      setInputValue(location.state.query);
    }
  }, [location.state]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const fetchResults = async () => {
      setLoading(true);
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
            { signal: controller.signal }
          ),
          fetch(
            `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
            { signal: controller.signal }
          ),
        ]);

        const [movieData, tvData] = await Promise.all([
          movieRes.json(),
          tvRes.json(),
        ]);

        const movies = (movieData.results || [])
          .filter((m) => m.poster_path)
          .map((m) => ({ ...m, media_type: "movie" }));

        const shows = (tvData.results || [])
          .filter((t) => t.poster_path)
          .map((t) => ({ ...t, media_type: "tv" }));

        // Sort by popularity (TMDB provides a popularity score)
        const combined = [...movies, ...shows].sort(
          (a, b) => (b.popularity || 0) - (a.popularity || 0)
        );

        setResults(combined);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    return () => controller.abort();
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    navigate("/search", { state: { query: inputValue.trim() } });
    setQuery(inputValue.trim());
  };

  const filtered = results.filter((r) => {
    if (filter === "Movies") return r.media_type === "movie";
    if (filter === "TV Shows") return r.media_type === "tv";
    return true;
  });

  return (
    <main id="main-content" className="search-page pulldown2">
      <SEOHelmet
        title={query ? `"${query}" — Search | TobbiHub` : "Search | TobbiHub"}
        description={`Search results for "${query}" on TobbiHub. Stream HD movies and TV shows free.`}
        keywords={`${query}, movies, tv shows, TobbiHub`}
      />

      {/* Search bar */}
      <div className="search-hero">
        <h1 className="search-heading">Find something to watch</h1>
        <form className="search-form" onSubmit={handleSubmit} role="search">
          <input
            ref={inputRef}
            type="search"
            className="search-bar-input"
            placeholder="Search movies, TV shows…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label="Search movies and TV shows"
            autoFocus
          />
          <button type="submit" className="search-bar-btn">Search</button>
        </form>
      </div>

      {/* Filter tabs + count */}
      {query && (
        <div className="search-meta">
          <div className="search-filters" role="tablist" aria-label="Filter results">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`search-filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {!loading && (
            <p className="search-count">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for{" "}
              <strong>"{query}"</strong>
            </p>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="search-grid">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="search-card search-skeleton" aria-hidden="true">
              <div className="search-card-poster skeleton-box" />
              <div className="search-card-info">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-sub" />
                <div className="skeleton-line skeleton-sub short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && filtered.length > 0 && (
        <div className="search-grid">
          {filtered.map((item) => {
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            const rating = item.vote_average?.toFixed(1);
            const link = item.media_type === "tv" ? `/tv/${item.id}` : `/watch/${item.id}`;
            const overview = item.overview?.slice(0, 100);

            return (
              <Link
                key={`${item.media_type}-${item.id}`}
                to={link}
                className="search-card"
                aria-label={`Watch ${title}${year ? ` (${year})` : ""}`}
              >
                <div className="search-card-poster">
                  <img
                    src={`${TMDB_IMG}${item.poster_path}`}
                    alt={title}
                    loading="lazy"
                  />
                  <span className={`search-type-badge ${item.media_type}`}>
                    {item.media_type === "tv" ? "TV" : "Movie"}
                  </span>
                </div>
                <div className="search-card-info">
                  <h3 className="search-card-title">{title}</h3>
                  <div className="search-card-meta">
                    {year && <span className="search-year">{year}</span>}
                    {rating && rating !== "0.0" && (
                      <span className="search-rating">⭐ {rating}</span>
                    )}
                  </div>
                  {overview && (
                    <p className="search-card-overview">{overview}…</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && query && filtered.length === 0 && (
        <div className="search-empty">
          <p className="search-empty-title">No results for "{query}"</p>
          <p className="search-empty-sub">Try a different spelling or keyword.</p>
        </div>
      )}

      {/* Initial state */}
      {!query && !loading && (
        <div className="search-empty">
          <p className="search-empty-title">Start typing to search</p>
          <p className="search-empty-sub">Movies, TV shows, anime — all in one place.</p>
        </div>
      )}
    </main>
  );
}
