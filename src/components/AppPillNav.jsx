import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiFilm,
  FiMonitor,
  FiRadio,
  FiSearch,
  FiMoreHorizontal,
} from "react-icons/fi";
import AppMoreSheet from "./AppMoreSheet";
import useNotifications from "../hooks/useNotifications";

const tabs = [
  { id: "home", label: "Home", path: "/", icon: FiHome },
  { id: "movies", label: "Movies", path: "/movies", icon: FiFilm },
  { id: "tv", label: "TV Shows", path: "/tvshows", icon: FiMonitor },
  { id: "live", label: "Live TV", path: "/livetv", icon: FiRadio },
  { id: "search", label: "Search", path: "/search", icon: FiSearch },
];

export default function AppPillNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { items } = useNotifications();
  const unread = items.filter((item) => item.unread).length;

  return (
    <>
      <nav className="app-pill" aria-label="Primary">
        <ul>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? "app-pill__tab is-active" : "app-pill__tab"
                  }
                >
                  <Icon />
                  <span className="app-pill__label">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className="app-pill__tab app-pill__more"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <FiMoreHorizontal />
              <span className="app-pill__label">More</span>
              {unread > 0 && <span className="app-pill__dot" aria-hidden="true" />}
            </button>
          </li>
        </ul>
      </nav>
      <AppMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
