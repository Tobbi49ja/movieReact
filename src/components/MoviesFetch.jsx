import { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import Loader from "./Loader";

export default function MoviesFetch({ title, apiUrl }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        console.log(`${title} data:`, data.results);
        const onlyMovies = data.results?.filter(
          (item) => (item.title || item.name) && item.poster_path
        );
        setMovies(onlyMovies);
      } catch (err) {
        console.error("Error fetching movies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [apiUrl, title]);

  if (loading) {
    return <Loader />;
  }

  if (!movies.length) {
    return <p className="loading">No {title.toLowerCase()} found.</p>;
  }

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
    </section>
  );
}
