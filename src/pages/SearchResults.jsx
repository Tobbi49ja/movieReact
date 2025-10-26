import { useState, useEffect } from "react";
import MovieCard from "../components/MovieCard";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // Fetch results while typing (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(
              query
            )}&language=en-US&include_adult=false`
          ),
          fetch(
            `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(
              query
            )}&language=en-US&include_adult=false`
          ),
        ]);

        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        const mergedResults = [
          ...(movieData.results || []).map((m) => ({
            ...m,
            media_type: "movie",
          })),
          ...(tvData.results || []).map((t) => ({ ...t, media_type: "tv" })),
        ];

        setResults(mergedResults);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query, TMDB_KEY]);

  return (
    <main className="search-page pulldown2">
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
              title={item.title || item.name}
              year={
                item.release_date?.split("-")[0] ||
                item.first_air_date?.split("-")[0] ||
                "N/A"
              }
              image={
                item.poster_path
                  ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                  : null
              }
              type={item.media_type === "movie" ? "Movie" : "TV Show"}
            />
          ))
        ) : (
          query && <p className="loading">No results for "{query}"</p>
        )}
      </div>
    </main>
  );
}
