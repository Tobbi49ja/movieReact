import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDataSaver } from "../utils/dataSaver";
import {
  FiHome,
  FiFilm,
  FiRadio,
  FiSearch,
  FiUser,
  FiWifiOff,
  FiWifi,
} from "react-icons/fi";

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { enabled: dataSaver, toggle: toggleDataSaver } = useDataSaver();

  const isActive = (path) => location.pathname === path;

  const tabs = [
    { to: "/", label: "Home", icon: FiHome },
    { to: "/movies", label: "Movies", icon: FiFilm },
    { to: "/livetv", label: "Live TV", icon: FiRadio },
    { to: "/search", label: "Search", icon: FiSearch },
    { to: user ? "/watchlist" : "/login", label: user ? "Profile" : "Login", icon: FiUser },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {tabs.map((tab) => {
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
      <button
        className="bottom-tab"
        onClick={toggleDataSaver}
        aria-label={dataSaver ? "Disable data saver" : "Enable data saver"}
        title={dataSaver ? "Data saver: On" : "Data saver: Off"}
      >
        {dataSaver ? <FiWifiOff /> : <FiWifi />}
        <span>Data Saver</span>
      </button>
    </nav>
  );
}