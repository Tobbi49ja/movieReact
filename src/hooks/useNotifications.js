import { useCallback, useEffect, useRef, useState } from "react";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

const SEEN_KEY = "tb_notif_seen";
const FETCH_THROTTLE_MS = 60 * 1000;

let seen = readSeen();
let lastFetchAt = 0;
const listeners = new Set();

function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
  } catch {
    return null;
  }
}

function writeSeen(value) {
  seen = value;
  try {
    if (value) localStorage.setItem(SEEN_KEY, value);
    else localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
}

function notify() {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

function withUnread(items) {
  const seenTime = seen ? Date.parse(seen) : 0;
  return items.map((item) => ({
    ...item,
    unread: !seenTime || Date.parse(item.createdAt) > seenTime,
  }));
}

export default function useNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const fetchItems = useCallback(async () => {
    const now = Date.now();
    if (fetchingRef.current || now - lastFetchAt < FETCH_THROTTLE_MS) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications?limit=30`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(withUnread(list));
      setError(null);
      lastFetchAt = Date.now();
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onFocus = () => fetchItems();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchItems]);

  useEffect(() => {
    const cb = () => {
      setItems((prev) => withUnread(prev));
    };
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const markAllSeen = useCallback(() => {
    setItems((prev) => {
      if (!prev.length) return prev;
      const newest = prev.reduce(
        (max, item) => Math.max(max, Date.parse(item.createdAt) || 0),
        0
      );
      if (newest > 0) writeSeen(new Date(newest).toISOString());
      notify();
      return withUnread(prev);
    });
  }, []);

  return { items, loading, error, markAllSeen };
}
