import { useCallback, useState } from "react";

const MAX = 8;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

export default function useSearchHistory(key) {
  const [items, setItems] = useState(() => read(key));

  const add = useCallback((q) => {
    const v = String(q ?? "").trim();
    if (v.length < 2) return;
    setItems((prev) => {
      const next = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX);
      write(key, next);
      return next;
    });
  }, [key]);

  const remove = useCallback((q) => {
    const v = String(q ?? "").trim().toLowerCase();
    setItems((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== v);
      write(key, next);
      return next;
    });
  }, [key]);

  const clear = useCallback(() => {
    setItems([]);
    write(key, []);
  }, [key]);

  return { items, add, remove, clear };
}
