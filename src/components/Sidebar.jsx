import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useContentMode } from "../context/ContentModeContext";
import {
  FiHome,
  FiFilm,
  FiTv,
  FiRadio,
  FiBookmark,
  FiSearch,
  FiSettings,
  FiUser,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, logout } = useAuth();
  const { mode, setMode } = useContentMode();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    navigate("/search", { state: { query: searchTerm.trim() } });
    setSearchTerm("");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLinks = [
    { to: "/", label: "Home", icon: FiHome },
    { to: "/movies", label: "Movies", icon: FiFilm },
    { to: "/tvshows", label: "TV Shows", icon: FiTv },
    { to: "/livetv", label: "Live TV", icon: FiRadio },
    { to: "/watchlist", label: "Watchlist", icon: FiBookmark, auth: true },
  ];

  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      {/* TOP SECTION */}
      <div className="sidebar-top">
        <div className="sidebar-logo">
          {collapsed ? (
            <span className="sidebar-logo-icon">T</span>
          ) : (
            <img src="/Logo.png" alt="TobbiHub" className="sidebar-logo-img" />
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      {/* NAV LINKS */}
      <nav className="sidebar-nav">
        <ul>
          {navLinks.map((link) => {
            if (link.auth && !user) return null;
            const Icon = link.icon;
            const active = location.pathname === link.to;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`sidebar-link ${active ? "active" : ""}`}
                  title={collapsed ? link.label : ""}
                >
                  <Icon className="sidebar-link-icon" />
                  {!collapsed && <span className="sidebar-link-label">{link.label}</span>}
                </Link>
              </li>
            );
          })}

          {/* Admin link (only if admin role) */}
          {user?.role === "admin" && (
            <li>
              <Link
                to="/admin"
                className={`sidebar-link ${location.pathname === "/admin" ? "active" : ""}`}
                title={collapsed ? "Admin" : ""}
              >
                <FiUser className="sidebar-link-icon" />
                {!collapsed && <span className="sidebar-link-label">Admin</span>}
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* SEARCH */}
      <div className="sidebar-search">
        <form onSubmit={handleSearch} className="sidebar-search-form">
          <FiSearch
            className="sidebar-search-icon"
            onClick={() => collapsed && setCollapsed(false)}
          />
          {!collapsed && (
            <input
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          )}
        </form>
      </div>

      {/* BOTTOM SECTION */}
      <div className="sidebar-bottom">
        {/* Mode toggle pill */}
        <div className="sidebar-mode-toggle">
          <button
            onClick={() => setMode("hollywood")}
            className={mode === "hollywood" ? "active-hollywood" : ""}
            aria-label="Hollywood mode"
          >
            🇺🇸 {!collapsed && "Hollywood"}
          </button>
          <button
            onClick={() => setMode("nollywood")}
            className={mode === "nollywood" ? "active-nollywood" : ""}
            aria-label="Nollywood mode"
          >
            🇳🇬 {!collapsed && "Nollywood"}
          </button>
        </div>

        {/* User section */}
        {user ? (
          <div className="sidebar-user">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="sidebar-avatar" />
            ) : (
              <span className="sidebar-avatar-initial">
                {user.name?.charAt(0)}
              </span>
            )}
            {!collapsed && <span className="sidebar-user-name">{user.name}</span>}
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
            >
              <FiLogOut />
            </button>
          </div>
        ) : (
          <Link to="/login" className="sidebar-login-btn" title="Login">
            <FiUser />
            {!collapsed && "Login"}
          </Link>
        )}
      </div>
    </aside>
  );
}