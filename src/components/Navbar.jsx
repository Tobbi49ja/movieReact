import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const [navOpen, setNavOpen] = useState(false);
  const [showGenres, setShowGenres] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  const toggleNav = () => setNavOpen(!navOpen);
  const toggleGenres = () => setShowGenres(!showGenres);
  const closeMenu = () => {
    setNavOpen(false);
    setShowGenres(false);
  };

  // ✅ Detect screen resize (now 768px)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavClick = (path) => {
    if (location.pathname === path) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => window.location.reload(), 500);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    closeMenu();
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
          searchTerm
        )}&include_adult=false`
      );
      const data = await res.json();

      if (data.results?.length > 0) {
        navigate("/search", {
          state: { results: data.results, query: searchTerm },
        });
      } else {
        alert("No movies found!");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Something went wrong. Try again later!");
    }

    setSearchTerm("");
    closeMenu();
  };

  return (
    <header>
      <div className="logo-container">
        <Link to="/" onClick={() => handleNavClick("/")}>
          <img src="/Logo.png" className="logo" alt="Logo" />
        </Link>
      </div>

      <nav id="nav-menu" className={navOpen ? "active" : ""}>
        <ul>
          <li>
            <Link to="/" onClick={() => handleNavClick("/")}>
              home
            </Link>
          </li>
          <li>
            <Link to="/movies" onClick={() => handleNavClick("/movies")}>
              movies
            </Link>
          </li>
          <li>
            <Link to="/tvshows" onClick={() => handleNavClick("/tvshows")}>
              tv shows
            </Link>
          </li>

          <li className="relative">
            <a href="#" onClick={toggleGenres}>
              genres
            </a>
            <div
              className="genre-dropdown"
              style={{ display: showGenres ? "block" : "none" }}
            >
              <Link
                to="/genres/action"
                onClick={() => handleNavClick("/genres/action")}
              >
                Action
              </Link>
              <Link
                to="/genres/comedy"
                onClick={() => handleNavClick("/genres/comedy")}
              >
                Comedy
              </Link>
              <Link
                to="/genres/animation"
                onClick={() => handleNavClick("/genres/animation")}
              >
                Animation
              </Link>
              <Link
                to="/genres/anime"
                onClick={() => handleNavClick("/genres/anime")}
              >
                Anime
              </Link>
              <Link
                to="/genres/drama"
                onClick={() => handleNavClick("/genres/drama")}
              >
                Drama
              </Link>
              <Link
                to="/genres/horror"
                onClick={() => handleNavClick("/genres/horror")}
              >
                Horror
              </Link>
            </div>
          </li>
        </ul>

        {/* ✅ Search bar INSIDE nav only on 768px and below */}
        {isMobile && (
          <form className="search-box mobile-search" onSubmit={handleSearch}>
            <input
              className="input-search"
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>
        )}
      </nav>

      {/* ✅ Search bar OUTSIDE nav only on desktop */}
      {!isMobile && (
        <form className="search-box" onSubmit={handleSearch}>
          <input
            className="input-search"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
      )}

      <div
        className={`hamburger ${navOpen ? "active" : ""}`}
        onClick={toggleNav}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>
    </header>
  );
}
