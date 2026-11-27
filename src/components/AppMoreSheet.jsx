import * as Dialog from "@radix-ui/react-dialog";
import { Link, NavLink } from "react-router-dom";
import {
  FiBookmark,
  FiDownload,
  FiUser,
  FiLogOut,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import { useContentMode } from "../context/ContentModeContext";
import { useDataSaver } from "../utils/dataSaver";
import { useAuth } from "../context/AuthContext";

export default function AppMoreSheet({ open, onOpenChange }) {
  const { mode, setMode } = useContentMode();
  const { enabled: dataSaver, toggle: toggleDataSaver } = useDataSaver();
  const { user, logout } = useAuth();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-sheet__overlay" />
        <Dialog.Content className="app-sheet" aria-describedby={undefined}>
          <Dialog.Title
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            More
          </Dialog.Title>

          <div className="app-sheet__grabber" />

          <div className="app-sheet__modes">
            <button
              type="button"
              className={mode === "hollywood" ? "is-active" : undefined}
              onClick={() => setMode("hollywood")}
            >
              Hollywood
            </button>
            <button
              type="button"
              className={mode === "nollywood" ? "is-active" : undefined}
              onClick={() => setMode("nollywood")}
            >
              Nollywood
            </button>
          </div>

          <NavLink
            to="/watchlist"
            className="app-sheet__row"
            onClick={() => onOpenChange(false)}
          >
            <FiBookmark />
            <span>Watchlist</span>
          </NavLink>

          <NavLink
            to="/downloads"
            className="app-sheet__row"
            onClick={() => onOpenChange(false)}
          >
            <FiDownload />
            <span>Downloads</span>
          </NavLink>

          {user?.role === "admin" ? (
            <Link
              to="/admin"
              className="app-sheet__row"
              onClick={() => onOpenChange(false)}
            >
              <FiUser />
              <span>Admin</span>
            </Link>
          ) : user ? (
            <button
              type="button"
              className="app-sheet__row"
              onClick={() => {
                logout();
                onOpenChange(false);
              }}
            >
              <FiLogOut />
              <span>Logout</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="app-sheet__row"
              onClick={() => onOpenChange(false)}
            >
              <FiUser />
              <span>Login</span>
            </Link>
          )}

          <button
            type="button"
            className="app-sheet__row"
            role="switch"
            aria-checked={dataSaver}
            onClick={toggleDataSaver}
          >
            {dataSaver ? <FiWifiOff /> : <FiWifi />}
            <span>Data Saver</span>
            <span className={dataSaver ? "app-switch is-on" : "app-switch"} />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
