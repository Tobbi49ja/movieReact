import MoviesFetch from "../../components/MoviesFetch";

export default function Anime() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <h1>Anime</h1>
      <MoviesFetch
        title="Popular Anime TV Shows"
        apiUrl={`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&with_original_language=ja&sort_by=popularity.desc&page=1`}
      />

      <MoviesFetch
        title="Popular Anime Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_original_language=ja&sort_by=popularity.desc&page=1`}
      />
    </main>
  );
}
