import MoviesFetch from "../components/MoviesFetch";
import Loader from "../components/Loader";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function Movies() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      {/* ✅ SEO for Movies Page */}
      <SEOHelmet
        title="Movies - Watch Latest & Trending Films | Tobbihub"
        description="Discover and stream popular, top-rated, and upcoming movies on Tobbihub. Enjoy HD quality, fast streaming, and no sign-ups required."
        keywords="Tobbihub, movies, latest movies, popular movies, top rated movies, upcoming films, streaming, HD movies"
        image="/assets/favicon/favicon.ico"
        url="https://moviereact-zzye.onrender.com/movies"
      />

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
