import { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import Loader from "./Loader";

export default function MoviesFetch({ title, apiUrl }) {
  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadMovies = async (pageNum) => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}&page=${pageNum}`);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();

      const filtered = data.results?.filter(
        (item) => (item.title || item.name) && item.poster_path
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

  return (
    <section className="movies-section">
      <h2 className="section-title">{title}</h2>

      <div className="movies-grid">
        {movies.map((movie) => (
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
    </section>
  );
}
