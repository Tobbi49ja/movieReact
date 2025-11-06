import React from "react";
import { Link } from "react-router-dom";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function Sitemap() {
  return (
    <div className="pulldown sitemap-page">
      {/* SEO Meta Tags */}
      <SEOHelmet
        title="Sitemap - TobbiHub"
        description="Browse the TobbiHub sitemap to quickly find movies, TV shows, and essential pages like About, Contact, and Terms of Service."
        name="TobbiHub"
        type="website"
      />

      {/* Page Content */}
      <section className="page-container">
        <h1>Sitemap</h1>
        <p className="intro-text">
          Welcome to our sitemap! Explore all sections of our platform below.
        </p>

        <div className="sitemap-links">
          {/* Movies & TV */}
          <div className="sitemap-group">
            <h2>Movies & TV Shows</h2>
            <ul>
              <li><Link to="/movies">All Movies</Link></li>
              <li><Link to="/tvshows">TV Shows</Link></li>
              <li><Link to="/animation">Animations</Link></li>
            </ul>
          </div>

          {/* Information */}
          <div className="sitemap-group">
            <h2>Information</h2>
            <ul>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>

          {/* More Pages */}
          <div className="sitemap-group">
            <h2>Other Pages</h2>
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
