import MoviesFetch from "../../components/MoviesFetch";
import SEOHelmet from "../../components/seo/SEOHelmet";

export default function Anime() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <SEOHelmet
        title="Anime | TobbiHub"
        description="Explore popular anime movies and TV shows from Japan. Watch trending and classic anime streaming on TobbiHub."
        url="https://moviereact-zzye.onrender.com/genres/anime"
      />

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
