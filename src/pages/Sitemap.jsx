import React from "react";
import { Link } from "react-router-dom";

export default function Sitemap() {
  return (
    <div className="pulldown sitemap-page">
      <section className="page-container">
        <h1>Sitemap</h1>
        <p className="intro-text">
          Welcome to our sitemap! Explore all sections of our platform below.
        </p>

        <div className="sitemap-links">
          <div className="sitemap-group">
            <h2>Movies</h2>
            <ul>
              <li><Link to="/movies">All Movies</Link></li>
              <li><Link to="/tvshows">TV Shows</Link></li>
              <li><Link to="/animation">Animations</Link></li>
            </ul>
          </div>

          <div className="sitemap-group">
            <h2>Information</h2>
            <ul>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="sitemap-group">
            <h2>More</h2>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
