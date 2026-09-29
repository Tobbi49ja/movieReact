import { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import Loader from "./Loader";

export default function MoviesFetch({ title, apiUrl, source, modeSwitching, mode }) {
  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadMovies = async (pageNum) => {
    try {
      setLoading(true);
      const url = new URL(apiUrl);
      url.searchParams.set("page", pageNum);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();

      const results = Array.isArray(data?.results) ? data.results : [];

      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

      const filtered = results.filter(
        (item) => {
          if (!item.poster_path) return false;
          if (!item.title && !item.name) return false;
          // Only filter by age on first page; old movies appear on Load More
          if (pageNum > 1) return true;
          const dateStr = item.release_date || item.first_air_date;
          if (!dateStr) return true;
          const itemDate = new Date(dateStr);
          return itemDate >= tenYearsAgo;
        }
      );

      if (filtered.length === 0) {
        setHasMore(false);
        return;
      }

      // append new results
      setMovies((prev) => [...prev, ...filtered]);
    } catch (err) {
      console.error("Error fetching movies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset when apiUrl changes
    setMovies([]);
    setPage(1);
    setHasMore(true);
    loadMovies(1);
  }, [apiUrl]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadMovies(nextPage);
  };

  // Nollywood empty state: first page returned 0 valid results
  const showNollywoodEmpty =
    mode === "nollywood" && movies.length === 0 && !loading && !hasMore;

  return (
    <section className="movies-section">
      <h2 className="section-title">{title}</h2>

      {showNollywoodEmpty ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#888"
        }}>
          <div style={{fontSize: "3rem"}}>🎬</div>
          <p style={{marginTop: "12px", fontSize: "1rem"}}>
            No Nigerian content found in this category.
          </p>
          <p style={{fontSize: "0.85rem", color: "#666"}}>
            Switch to 🇺🇸 Hollywood for more options.
          </p>
        </div>
      ) : movies.length === 0 && mode === "hollywood" ? (
        <p className="no-more">No more movies to show</p>
      ) : (
        <>
          <div className={`movies-grid${modeSwitching ? " mode-switching" : ""}`}>
            {(Array.isArray(movies) ? movies : []).map((movie) => (
              <MovieCard
                key={movie.id}
                id={movie.id}
                title={movie.title || movie.name}
                year={
                  movie.release_date?.split("-")[0] ||
                  movie.first_air_date?.split("-")[0] ||
                  "N/A"
                }
                image={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                mediaType={movie.media_type || (movie.title ? "movie" : "tv")}
                source={source}
              />
            ))}
          </div>

          {loading && <Loader />}
          {!loading && hasMore && (
            <button onClick={handleLoadMore} className="load-more-btn">
              Load More
            </button>
          )}
          {!hasMore && <p className="no-more">No more movies to show</p>}
        </>
      )}
    </section>
  );
}
