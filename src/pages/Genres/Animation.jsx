import MoviesFetch from "../../components/MoviesFetch";
import SEOHelmet from "../../components/seo/SEOHelmet";

export default function Animation() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <SEOHelmet
        title="Animation Movies | TobbiHub"
        description="Enjoy animated films full of creativity, laughter, and emotion. Discover classic and new animation movies on TobbiHub."
        url="https://tobbihub.com/movies/animation"
      />

      <h1>Animation Movies</h1>

      <MoviesFetch
        title="Animation Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=16&page=1`}
      />
    </main>
  );
}
