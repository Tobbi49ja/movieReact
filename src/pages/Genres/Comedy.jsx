import MoviesFetch from "../../components/MoviesFetch";

export default function Comedy() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>Comedy</h1>

      <MoviesFetch
        title="Comedy Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=35&page=1`}
      />
    </main>
  );
}
