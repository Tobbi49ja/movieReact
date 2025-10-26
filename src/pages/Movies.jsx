import MoviesFetch from "../components/MoviesFetch";
import Loader from "../components/Loader";

export default function Movies() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>Movies</h1>

      {/* Popular Movies */}
      <MoviesFetch
        title="Popular Movies"
        apiUrl={`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Top Rated Movies */}
      <MoviesFetch
        title="Top Rated Movies"
        apiUrl={`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Upcoming Movies */}
      <MoviesFetch
        title="Upcoming Movies"
        apiUrl={`https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&language=en-US&page=1`}
      />
    </main>
  );
}
