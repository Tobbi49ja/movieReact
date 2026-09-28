import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useContentMode } from "../context/ContentModeContext";

export default function Navbar() {
  const [navOpen, setNavOpen] = useState(false);
  const [showGenres, setShowGenres] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [scrolled, setScrolled] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useContentMode();

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
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
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

  // Logout handler
  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
    closeMenu();
  };

  // Auth controls — rendered inline on desktop, inside the drawer on mobile
  const authContent = user ? (
    <>
      <Link to="/watchlist" className="nav-user" onClick={() => handleNavClick("/watchlist")} aria-label="My watchlist">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="nav-avatar" />
        ) : (
          <span className="nav-avatar nav-avatar-initial">
            {user.name?.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="nav-user-name">{user.name}</span>
      </Link>
      <button className="nav-logout-btn" onClick={handleLogout} aria-label="Logout">
        Logout
      </button>
    </>
  ) : (
    <Link to="/login" className="nav-auth-link" onClick={closeMenu}>
      Login
    </Link>
  );

  // Inline styles for mobile drawer — always win over CSS class rules
  const drawerStyle = navOpen && isMobile ? {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100vh",
    background: "#0a0a0a",
    zIndex: 9999,
    overflowY: "auto",
    padding: "80px 20px 40px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    boxSizing: "border-box",
  } : {};

  const ulStyle = navOpen && isMobile ? {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
    listStyle: "none",
    padding: 0,
    margin: 0,
  } : {};

  return (
    <header className={scrolled ? "navbar scrolled" : "navbar"} role="banner">
      <div className="logo-container">
        <Link to="/" onClick={() => handleNavClick("/")} aria-label="TobbiHub - Go to homepage">
          <img src="/Logo.png" className="logo" alt="TobbiHub Logo" />
        </Link>
      </div>

      {/* Close overlay — tap outside drawer to close */}
      {navOpen && (
        <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />
      )}

      <nav id="nav-menu" style={drawerStyle} className={navOpen ? "active" : ""} aria-label="Main navigation">
        <ul role="menubar" style={ulStyle}>
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

          {user && (
            <li role="none">
              <Link to="/watchlist" onClick={() => handleNavClick("/watchlist")} role="menuitem">
                watchlist
              </Link>
            </li>
          )}

          {user?.role === "admin" && (
            <li role="none">
              <Link to="/admin" onClick={() => handleNavClick("/admin")} role="menuitem">
                admin
              </Link>
            </li>
          )}

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

          {/* Content mode toggle — inside nav list for proper flex flow */}
          <li role="none" className="nav-mode-toggle-wrapper">
            <button
              className={`content-mode-toggle mode-${mode}`}
              onClick={toggleMode}
              aria-label="Switch content mode"
            >
              <span className={mode === "hollywood" ? "mode-pill active" : "mode-pill"}>🇺🇸 Hollywood</span>
              <span className={mode === "nollywood" ? "mode-pill active" : "mode-pill"}>🇳🇬 Nollywood</span>
            </button>
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
        {isMobile && (
          <div className="navbar-auth drawer-auth">{authContent}</div>
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

        {/* Desktop auth — hidden on mobile to avoid duplicate controls */}
        {!isMobile && (
          <div className="navbar-auth">{authContent}</div>
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
