import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";
import { App } from "@capacitor/app";
import { isApp } from "../lib/platform";
import { useContentMode } from "../context/ContentModeContext";
import { useDataSaver } from "../utils/dataSaver";
import { useAuth } from "../context/AuthContext";
import useDownloads from "../hooks/useDownloads";
import { deleteDownloadWithFile } from "../lib/downloads";
import { FiLogOut } from "react-icons/fi";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 MB";
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export default function Settings() {
  const { mode, setMode } = useContentMode();
  const { enabled: dataSaver, toggle: toggleDataSaver } = useDataSaver();
  const { user, logout } = useAuth();
  const downloads = useDownloads();
  const [version, setVersion] = useState("");
  const [latestVersionName, setLatestVersionName] = useState("");
  const [apkUrl, setApkUrl] = useState("");

  useEffect(() => {
    if (!isApp) return;
    let mounted = true;
    (async () => {
      try {
        const info = await App.getInfo();
        if (mounted) setVersion(info?.version || "");
      } catch {
        if (mounted) setVersion("");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/app-config?t=${Date.now()}`);
        const d = res.data?.data || {};
        if (mounted) {
          setLatestVersionName(d.latestVersionName || "");
          setApkUrl(d.apkUrl || "");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (typeof document !== "undefined" && document.documentElement.dataset.app !== "true") {
    return <Navigate to="/" replace />;
  }

  const doneDownloads = downloads.filter((d) => d.status === "done");
  const usedBytes = doneDownloads.reduce((sum, d) => sum + (Number(d.size) || 0), 0);

  const handleClearDownloads = () => {
    if (!window.confirm("Delete all downloaded files from this device?")) return;
    doneDownloads.forEach((d) => deleteDownloadWithFile(d));
  };

  return (
    <main className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-card">
        <h2 className="settings-heading">Content</h2>
        <div className="settings-modes">
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
      </section>

      <section className="settings-card">
        <h2 className="settings-heading">Data</h2>
        <button
          type="button"
          className="settings-row"
          role="switch"
          aria-checked={dataSaver}
          onClick={toggleDataSaver}
        >
          <span>Data Saver</span>
          <span className={dataSaver ? "app-switch is-on" : "app-switch"} />
        </button>
        <div className="settings-row">
          <span>Storage used by downloads</span>
          <span>{formatBytes(usedBytes)}</span>
        </div>
        <button type="button" className="settings-clear settings-danger" onClick={handleClearDownloads}>
          Clear all downloads
        </button>
      </section>

      <section className="settings-card">
        <h2 className="settings-heading">Account</h2>
        {user ? (
          <>
            <p className="settings-text">{user.name}</p>
            <p className="settings-text">{user.email}</p>
            <button type="button" className="settings-row" onClick={logout}>
              <span>Logout</span>
              <FiLogOut />
            </button>
          </>
        ) : (
          <Link to="/login" className="settings-row">
            <span>Login</span>
          </Link>
        )}
      </section>

      <section className="settings-card">
        <h2 className="settings-heading">About</h2>
        <div className="settings-row">
          <span>App version</span>
          <span>{version ? `v${version}` : "—"}</span>
        </div>
        <div className="settings-row">
          <span>Latest version</span>
          {apkUrl ? (
            <a href={apkUrl} target="_blank" rel="noopener noreferrer">
              {latestVersionName || apkUrl}
            </a>
          ) : (
            <span>{latestVersionName || "—"}</span>
          )}
        </div>
      </section>
    </main>
  );
}
