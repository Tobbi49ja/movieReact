import MoviesFetch from "../../components/MoviesFetch";

export default function Horror() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>Horror</h1>

      <MoviesFetch
        title="Horror Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=27&page=1`}
      />
    </main>
  );
}
