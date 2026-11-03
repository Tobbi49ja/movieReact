import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useContentMode } from "../context/ContentModeContext";
import { useDataSaver } from "../utils/dataSaver";
import {
  FiHome,
  FiFilm,
  FiTv,
  FiRadio,
  FiBookmark,
  FiSearch,
  FiUser,
  FiWifiOff,
  FiWifi,
} from "react-icons/fi";

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { mode, setMode } = useContentMode();
  const { enabled: dataSaver, toggle: toggleDataSaver } = useDataSaver();

  const isActive = (path) => location.pathname === path;

  const tabs = [
    { to: "/", label: "Home", icon: FiHome },
    { to: "/movies", label: "Movies", icon: FiFilm },
    { to: "/tvshows", label: "TV Shows", icon: FiTv },
    { to: "/livetv", label: "Live TV", icon: FiRadio },
    { to: "/watchlist", label: "Watchlist", icon: FiBookmark, auth: true },
    { to: "/search", label: "Search", icon: FiSearch },
    { to: user ? "/watchlist" : "/login", label: user ? "Profile" : "Login", icon: FiUser },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {tabs.map((tab) => {
        if (tab.auth && !user) return null;
        const Icon = tab.icon;
        const active = isActive(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={active ? "bottom-tab active" : "bottom-tab"}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            <span>{tab.label}</span>
          </Link>
        );
      })}

      {/* Admin link (only if admin role) */}
      {user?.role === "admin" && (
        <Link
          to="/admin"
          className={isActive("/admin") ? "bottom-tab active" : "bottom-tab"}
          aria-current={isActive("/admin") ? "page" : undefined}
        >
          <FiUser />
          <span>Admin</span>
        </Link>
      )}

      <button
        className="bottom-tab"
        onClick={toggleDataSaver}
        aria-label={dataSaver ? "Disable data saver" : "Enable data saver"}
        title={dataSaver ? "Data saver: On" : "Data saver: Off"}
        style={{ background: "transparent", border: "none" }}
      >
        {dataSaver ? <FiWifiOff /> : <FiWifi />}
        <span>Data Saver</span>
      </button>

      {/* Mode toggle pill — reuses setMode from useContentMode() */}
      <div className="bottom-mode-toggle">
        <button
          onClick={() => setMode("hollywood")}
          className={mode === "hollywood" ? "active-hollywood" : ""}
          aria-label="Hollywood mode"
          title="Hollywood"
        >
          🇺🇸 Hollywood
        </button>
        <button
          onClick={() => setMode("nollywood")}
          className={mode === "nollywood" ? "active-nollywood" : ""}
          aria-label="Nollywood mode"
          title="Nollywood"
        >
          🇳🇬 Nollywood
        </button>
      </div>
    </nav>
  );
}