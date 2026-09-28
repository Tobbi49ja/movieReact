import { useState, useEffect, useRef } from "react";
import MoviesFetch from "../components/MoviesFetch";
import Loader from "../components/Loader";
import SEOHelmet from "../components/seo/SEOHelmet";
import { useContentMode } from "../context/ContentModeContext";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function Movies() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
  const { mode } = useContentMode();
  const [switching, setSwitching] = useState(false);
  const firstMount = useRef(true);

  // Trigger fade animation only when mode actually changes (not on first mount)
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    setSwitching(true);
    const timer = setTimeout(() => setSwitching(false), 200);
    return () => clearTimeout(timer);
  }, [mode]);

  const nollywoodUrl = `${BACKEND_URL}/api/nollywood/trending`;

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

      {/* Nollywood banner */}
      {mode === "nollywood" && (
        <div className="nollywood-banner">🇳🇬 Now showing Nigerian movies</div>
      )}

      {/* Popular Movies */}
      <MoviesFetch
        key={`movies-popular-${mode}`}
        title="Popular Movies"
        apiUrl={
          mode === "nollywood"
            ? nollywoodUrl
            : `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        modeSwitching={switching}
      />

      {/* Top Rated Movies */}
      <MoviesFetch
        key={`movies-toprated-${mode}`}
        title="Top Rated Movies"
        apiUrl={
          mode === "nollywood"
            ? nollywoodUrl
            : `https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        modeSwitching={switching}
      />

      {/* Upcoming Movies */}
      <MoviesFetch
        key={`movies-upcoming-${mode}`}
        title="Upcoming Movies"
        apiUrl={
          mode === "nollywood"
            ? nollywoodUrl
            : `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        modeSwitching={switching}
      />
    </main>
  );
}