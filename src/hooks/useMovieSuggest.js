import { useEffect, useRef, useState } from "react";
import { TMDB_API_KEY, TMDB_BASE } from "../config/api";

const IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

export function useMovieSuggest(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = String(query || "").trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(async () => {
      if (controller.signal.aborted) return;
      try {
        const res = await fetch(
          `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(q)}&include_adult=false`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (controller.signal.aborted) return;

        const items = (data.results || [])
          .filter((item) => item.media_type === "movie" || item.media_type === "tv")
          .slice(0, 6)
          .map((item) => ({
            id: item.id,
            mediaType: item.media_type,
            title: item.title || item.name || "",
            year: (item.release_date || item.first_air_date || "").slice(0, 4),
            rating: Math.round((item.vote_average || 0) * 10) / 10,
            poster: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
          }));
        setResults(items);
      } catch (e) {
        if (e.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current.abort();
    };
  }, [query]);

  return { results, loading };
}
