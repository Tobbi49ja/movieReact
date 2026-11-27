import { useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { Browser } from "@capacitor/browser";
import useNotifications from "../hooks/useNotifications";
import { isApp } from "../lib/platform";

function relativeTime(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NotificationItem({ item }) {
  const inner = (
    <>
      <div className="notif-title">{item.title}</div>
      <p className="notif-body">{item.body}</p>
      <div className="notif-time">{relativeTime(item.createdAt)}</div>
      {item.unread && <span className="notif-dot" />}
    </>
  );

  if (item.link?.startsWith("/")) {
    return (
      <Link to={item.link} className="notif-item">
        {inner}
      </Link>
    );
  }

  if (/^https:\/\//.test(item.link || "")) {
    return (
      <a
        href={item.link}
        className="notif-item"
        target="_blank"
        rel="noopener noreferrer"
        onClick={async (e) => {
          if (!isApp) return;
          e.preventDefault();
          try {
            await Browser.open({ url: item.link });
          } catch {
            window.open(item.link, "_blank", "noopener,noreferrer");
          }
        }}
      >
        {inner}
      </a>
    );
  }

  return <div className="notif-item">{inner}</div>;
}

export default function Notifications() {
  const { items, loading, error, markAllSeen } = useNotifications();
  const markedRef = useRef(false);

  useEffect(() => {
    if (!loading && items.length > 0 && !markedRef.current) {
      markedRef.current = true;
      markAllSeen();
    }
  }, [loading, items.length, markAllSeen]);

  if (typeof document !== "undefined" && document.documentElement.dataset.app !== "true") {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="notif-page">
      <h1 className="notif-heading">Notifications</h1>

      {loading && items.length === 0 ? (
        <div className="notif-empty">Loading…</div>
      ) : error && items.length === 0 ? (
        <div className="notif-empty">Couldn't load notifications.</div>
      ) : items.length === 0 ? (
        <div className="notif-empty">No notifications yet.</div>
      ) : (
        items.map((item) => (
          <NotificationItem key={item._id || item.createdAt} item={item} />
        ))
      )}
    </main>
  );
}
