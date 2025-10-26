import MoviesFetch from "../components/MoviesFetch";

export default function TvShows() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>TV Shows</h1>

      {/* Airing Today */}
      <MoviesFetch
        title="Airing Today"
        apiUrl={`https://api.themoviedb.org/3/tv/airing_today?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Popular TV Shows */}
      <MoviesFetch
        title="Popular TV Shows"
        apiUrl={`https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Top Rated TV Shows */}
      <MoviesFetch
        title="Top Rated TV Shows"
        apiUrl={`https://api.themoviedb.org/3/tv/top_rated?api_key=${API_KEY}&language=en-US&page=1`}
      />
    </main>
  );
}
