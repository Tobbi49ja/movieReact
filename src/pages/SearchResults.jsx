import { useLocation, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import MovieCard from "../components/MovieCard";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function SearchResult() {
  const location = useLocation();
  const { query: routeQuery } = useParams();
  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // 🔹 Query state
  const [query, setQuery] = useState(location.state?.query || routeQuery || "");
  const [results, setResults] = useState(location.state?.results || []);
  const [loading, setLoading] = useState(false);

  // ✅ Sync query from route or state
  useEffect(() => {
    if (location.state?.query) {
      setQuery(location.state.query);
      setResults(location.state.results || []);
    } else if (routeQuery) {
      setQuery(routeQuery);
    }
  }, [location.state, routeQuery]);

  // 🔁 Fetch results when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(
              query
            )}&include_adult=false`
          ),
          fetch(
            `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(
              query
            )}&include_adult=false`
          ),
        ]);

        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        const combined = [
          ...(movieData.results || []).map((m) => ({
            ...m,
            media_type: "movie",
          })),
          ...(tvData.results || []).map((t) => ({
            ...t,
            media_type: "tv",
          })),
        ].sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || 0);
          const dateB = new Date(b.release_date || b.first_air_date || 0);
          return dateB - dateA;
        });

        setResults(combined);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, TMDB_KEY]);

  // ✅ Dynamic SEO text
  const seoTitle = query
    ? `Search results for “${query}” | Tobbihub`
    : "Search Movies and TV Shows | Tobbihub";

  const seoDescription = query
    ? `Find movies and TV shows matching “${query}” on Tobbihub. Stream HD titles instantly and explore trending films.`
    : "Search your favorite movies and TV shows on Tobbihub. Fast, accurate, and always updated.";

  return (
    <main className="search-page pulldown2">
      {/* ✅ SEOHelmet Integration */}
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        keywords={`Tobbihub, search ${query}, movies, tv shows, HD streaming`}
        image="/assets/favicon/favicon.ico"
        url={`https://tobbihub.com/search/${encodeURIComponent(query)}`}
      />

      <div className="search-container">
        <input
          type="text"
          placeholder="Search movies or TV shows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {loading && <p className="loading">Loading...</p>}

      <div className="movie-section">
        {results.length > 0 ? (
          results.map((item) => (
            <MovieCard
              key={`${item.media_type}-${item.id}`}
              id={item.id}
              title={item.title || item.name}
              year={
                item.release_date?.split("-")[0] ||
                item.first_air_date?.split("-")[0] ||
                "N/A"
              }
              image={
                item.poster_path
                  ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                  : "/no-image.jpg"
              }
              quality="HD"
              mediaType={item.media_type}
            />
          ))
        ) : (
          query &&
          !loading && <p className="loading">No results found for “{query}”</p>
        )}
      </div>
    </main>
  );
}
