import Hero from "../components/Hero";
import MoviesFetch from "../components/MoviesFetch";

export default function Home() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main>
      <Hero />

      {/* Fetch Now Playing */}
      <MoviesFetch
        title="Now Playing"
        apiUrl={`https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Fetch Popular Movies */}
      <MoviesFetch
        title="Popular Movies"
        apiUrl={`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=1`}
      />

      {/* Fetch Top Rated */}
      <MoviesFetch
        title="Top Rated"
        apiUrl={`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`}
      />
    </main>
  );
}
