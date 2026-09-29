import { useState, useEffect, useRef } from "react";
import Hero from "../components/Hero";
import MoviesFetch from "../components/MoviesFetch";
import SEOHelmet from "../components/seo/SEOHelmet";
import { useContentMode } from "../context/ContentModeContext";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function Home() {
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

  const hollywoodUrls = {
    "Now Playing": `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=en-US`,
    "Popular Movies": `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US`,
    "Top Rated": `https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=en-US`,
  };

  const nollywoodUrl = `${BACKEND_URL}/api/nollywood/trending`;

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

      {/* Nollywood banner */}
      {mode === "nollywood" && (
        <div style={{
          background: "linear-gradient(90deg, #008751, #ffffff22, #008751)",
          color: "#fff",
          textAlign: "center",
          padding: "6px",
          fontSize: "0.85rem",
          fontWeight: 600
        }}>🇳🇬 Now showing Nigerian movies</div>
      )}

      {/* ✅ Movie Sections */}
      <MoviesFetch
        key={`home-nowplaying-${mode}`}
        title="Now Playing"
        apiUrl={mode === "nollywood" ? nollywoodUrl : hollywoodUrls["Now Playing"]}
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />

      <MoviesFetch
        key={`home-popular-${mode}`}
        title="Popular Movies"
        apiUrl={mode === "nollywood" ? nollywoodUrl : hollywoodUrls["Popular Movies"]}
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />

      <MoviesFetch
        key={`home-toprated-${mode}`}
        title="Top Rated"
        apiUrl={mode === "nollywood" ? nollywoodUrl : hollywoodUrls["Top Rated"]}
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />
    </main>
  );
}