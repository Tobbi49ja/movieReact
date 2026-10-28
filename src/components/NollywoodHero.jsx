import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { tmdbImg } from "../utils/tmdb";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  "https://moviereact-zzye.onrender.com";

export default function NollywoodHero() {
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/nollywood/trending`)
      .then(r => r.json())
      .then(data => {
        const movies = (data.results || []).filter(m => m.backdrop_path && m.overview);
        if (movies.length) setFeatured(movies[0]);
      })
      .catch(() => {});
  }, []);

  if (!featured) return null;

  return (
    <div className="nollywood-hero">
      <div
        className="nollywood-hero-bg"
        style={{
          backgroundImage: `url(${tmdbImg(featured.backdrop_path, "w780")})`
        }}
      />
      <div className="nollywood-hero-overlay" />
      <div className="nollywood-hero-content">
        <span className="nollywood-hero-badge">🇳🇬 Featured Nigerian Film</span>
        <h1>{featured.title}</h1>
        <p>{featured.overview?.slice(0, 150)}...</p>
        <div className="nollywood-hero-actions">
          <Link to={`/watch/${featured.id}`} className="hero-watch-btn">
            ▶ Watch Now
          </Link>
        </div>
      </div>
    </div>
  );
}
