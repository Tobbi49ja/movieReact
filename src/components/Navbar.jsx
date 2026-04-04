import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const [navOpen, setNavOpen] = useState(false);
  const [showGenres, setShowGenres] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [scrolled, setScrolled] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Toggle mobile nav
  const toggleNav = () => setNavOpen(!navOpen);

  // Toggle genres dropdown
  const toggleGenres = (e) => {
    e.preventDefault();
    setShowGenres(!showGenres);
  };

  // Close menus
  const closeMenu = () => {
    setNavOpen(false);
    setShowGenres(false);
  };

  // Detect window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Collapse genres when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showGenres && !e.target.closest(".genre-wrapper")) {
        setShowGenres(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showGenres]);

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 150) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle navigation clicks
  const handleNavClick = (path) => {
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => window.location.reload(), 500);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    closeMenu();
  };

  // Search handler — just navigate, SearchResults handles the fetch
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    navigate("/search", { state: { query: searchTerm.trim() } });
    setSearchTerm("");
    closeMenu();
  };

  return (
    <header className={scrolled ? "navbar scrolled" : "navbar"} role="banner">
      <div className="logo-container">
        <Link to="/" onClick={() => handleNavClick("/")} aria-label="TobbiHub - Go to homepage">
          <img src="/Logo.png" className="logo" alt="TobbiHub Logo" />
        </Link>
      </div>

      <nav id="nav-menu" className={navOpen ? "active" : ""} aria-label="Main navigation">
        <ul role="menubar">
          <li role="none">
            <Link to="/" onClick={() => handleNavClick("/")} role="menuitem">
              home
            </Link>
          </li>
          <li role="none">
            <Link to="/movies" onClick={() => handleNavClick("/movies")} role="menuitem">
              movies
            </Link>
          </li>
          <li role="none">
            <Link to="/tvshows" onClick={() => handleNavClick("/tvshows")} role="menuitem">
              tv shows
            </Link>
          </li>

          {/* GENRES DROPDOWN */}
          <li className="relative genre-wrapper" role="none">
            <a
              href="#"
              onClick={toggleGenres}
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={showGenres}
            >
              genres
            </a>

            <div
              className="genre-dropdown"
              role="menu"
              aria-label="Genre categories"
              style={{ display: showGenres ? "block" : "none" }}
            >
              <Link to="/genres/action" onClick={() => handleNavClick("/genres/action")} role="menuitem">Action</Link>
              <Link to="/genres/comedy" onClick={() => handleNavClick("/genres/comedy")} role="menuitem">Comedy</Link>
              <Link to="/genres/animation" onClick={() => handleNavClick("/genres/animation")} role="menuitem">Animation</Link>
              <Link to="/genres/anime" onClick={() => handleNavClick("/genres/anime")} role="menuitem">Anime</Link>
              <Link to="/genres/drama" onClick={() => handleNavClick("/genres/drama")} role="menuitem">Drama</Link>
              <Link to="/genres/horror" onClick={() => handleNavClick("/genres/horror")} role="menuitem">Horror</Link>
            </div>
          </li>
        </ul>

        {/* Mobile search */}
        {isMobile && (
          <form className="search-box mobile-search" onSubmit={handleSearch} role="search">
            <input
              className="input-search"
              type="search"
              placeholder="Search movies..."
              aria-label="Search movies and TV shows"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>
        )}
      </nav>

      {/* Desktop search */}
      {!isMobile && (
        <form className="search-box" onSubmit={handleSearch} role="search">
          <input
            className="input-search"
            type="search"
            placeholder="Search movies..."
            aria-label="Search movies and TV shows"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
      )}

      <button
        className={`hamburger ${navOpen ? "active" : ""}`}
        onClick={toggleNav}
        aria-label={navOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={navOpen}
        aria-controls="nav-menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </header>
  );
}
