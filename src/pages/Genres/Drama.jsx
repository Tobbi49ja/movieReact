import MoviesFetch from "../../components/MoviesFetch";

export default function Drama() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>Drama</h1>

      <MoviesFetch
        title="Drama Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=18&page=1`}
      />
    </main>
  );
}
