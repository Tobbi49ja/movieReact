import { useState, useEffect, useRef } from "react";
import MoviesFetch from "../components/MoviesFetch";
import SEOHelmet from "../components/seo/SEOHelmet";
import { useContentMode } from "../context/ContentModeContext";
import { TMDB_API_KEY } from "../config/api";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function TvShows() {
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

  // Nollywood TV shows via TMDB discover filtered by origin country
  const nollywoodTvUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=NG&sort_by=first_air_date.desc&vote_count.gte=5`;

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

      {/* Nollywood banner */}
      {mode === "nollywood" && (
        <div style={{
          background: "linear-gradient(90deg, #008751, #ffffff22, #008751)",
          color: "#fff",
          textAlign: "center",
          padding: "6px",
          fontSize: "0.85rem",
          fontWeight: 600
        }}>🇳🇬 Now showing Nigerian TV shows</div>
      )}

      {/* Airing Today */}
      <MoviesFetch
        key={`tv-airing-${mode}`}
        title={mode === "nollywood" ? "🇳🇬 Nigerian TV Shows" : "Airing Today"}
        apiUrl={
          mode === "nollywood"
            ? nollywoodTvUrl
            : `https://api.themoviedb.org/3/tv/airing_today?api_key=${TMDB_API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />

      {/* Popular TV Shows */}
      <MoviesFetch
        key={`tv-popular-${mode}`}
        title={mode === "nollywood" ? "🇳🇬 Nigerian TV Shows" : "Popular TV Shows"}
        apiUrl={
          mode === "nollywood"
            ? nollywoodTvUrl
            : `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />

      {/* Top Rated TV Shows */}
      <MoviesFetch
        key={`tv-toprated-${mode}`}
        title={mode === "nollywood" ? "🇳🇬 Nigerian TV Shows" : "Top Rated TV Shows"}
        apiUrl={
          mode === "nollywood"
            ? nollywoodTvUrl
            : `https://api.themoviedb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}&language=en-US`
        }
        source={mode === "nollywood" ? "Nollywood" : undefined}
        mode={mode}
        modeSwitching={switching}
      />
    </main>
  );
}