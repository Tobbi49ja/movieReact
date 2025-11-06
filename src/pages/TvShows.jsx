import MoviesFetch from "../components/MoviesFetch";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function TvShows() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      {/* ✅ SEO Section */}
      <SEOHelmet
        title="TV Shows - Watch Popular & Top Rated Series | Tobbihub"
        description="Stream the latest TV shows, top-rated series, and trending episodes online for free on Tobbihub. Enjoy HD quality streaming anytime, anywhere."
        keywords="Tobbihub, TV shows, series, popular TV shows, top rated shows, streaming, HD series, watch online"
        image="/assets/favicon/favicon.ico"
        url="https://moviereact-zzye.onrender.com/tvshows"
      />

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
