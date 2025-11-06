import Hero from "../components/Hero";
import MoviesFetch from "../components/MoviesFetch";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function Home() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main>
      {/* ✅ SEO Section */}
      <SEOHelmet
        title="Tobbihub - Watch Movies & TV Shows Online Free"
        description="Stream the latest movies, trending TV shows, and top-rated films online for free on Tobbihub. Fast, smooth, and ad-light streaming experience."
        keywords="Tobbihub, free movies, streaming, HD movies, TV shows, top rated, popular films"
        image="/assets/favicon/favicon.ico"
        url="https://moviereact-zzye.onrender.com"
      />

      {/* ✅ Hero Section */}
      <Hero />

      {/* ✅ Movie Sections */}
      <MoviesFetch
        title="Now Playing"
        apiUrl={`https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=en-US&page=1`}
      />

      <MoviesFetch
        title="Popular Movies"
        apiUrl={`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=1`}
      />

      <MoviesFetch
        title="Top Rated"
        apiUrl={`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`}
      />
    </main>
  );
}
