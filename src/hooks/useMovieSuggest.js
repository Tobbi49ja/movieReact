import { useEffect, useRef, useState } from "react";
import { TMDB_API_KEY, TMDB_BASE } from "../config/api";
import { cleanQuery } from "../utils/searchQuery";

const IMAGE_BASE = "https://image.tmdb.org/t/p/w92";
const MAX_RESULTS = 8;
const MAX_RETRIES = 3;
const DEBOUNCE_MS = 350;
const CACHE_LIMIT = 20;

async function fetchMulti(term, signal) {
  const res = await fetch(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(term)}&include_adult=false`,
    { signal }
  );
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.results || [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map((item) => ({
      id: item.id,
      mediaType: item.media_type,
      title: item.title || item.name || "",
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      rating: Math.round((item.vote_average || 0) * 10) / 10,
      poster: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    }));
}

async function searchWithFallback(term, signal) {
  let items = await fetchMulti(term, signal);
  if (items.length > 0) return items;

  let words = term.split(" ");
  if (words.length <= 2) return items;

  for (let attempt = 0; attempt < MAX_RETRIES && items.length === 0 && words.length > 1; attempt++) {
    words = words.slice(0, -1);
    items = await fetchMulti(words.join(" "), signal);
  }
  return items;
}

function rankAndDedupe(items, clean) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const q = clean.toLowerCase();
  const score = (item) => {
    const title = item.title.toLowerCase();
    if (title === q) return 0;
    if (title.startsWith(q)) return 1;
    return 2;
  };

  deduped.sort((a, b) => score(a) - score(b));
  return deduped.slice(0, MAX_RESULTS);
}

export function useMovieSuggest(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clean, setClean] = useState("");
  const [year, setYear] = useState("");
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const previous = abortRef.current;
    if (previous) previous.abort();

    const raw = String(query || "").trim();
    if (raw.length < 2) {
      abortRef.current = null;
      setResults([]);
      setClean("");
      setYear("");
      setLoading(false);
      return;
    }

    const parsed = cleanQuery(raw);
    const term = parsed.clean || raw;

    const cached = cacheRef.current.get(term);
    if (cached) {
      abortRef.current = null;
      setResults(cached);
      setClean(term);
      setYear(parsed.year);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(async () => {
      if (controller.signal.aborted) return;
      try {
        const items = await searchWithFallback(term, controller.signal);
        if (controller.signal.aborted) return;
        const ranked = rankAndDedupe(items, term);
        cacheRef.current.set(term, ranked);
        if (cacheRef.current.size > CACHE_LIMIT) {
          cacheRef.current.delete(cacheRef.current.keys().next().value);
        }
        setResults(ranked);
        setClean(term);
        setYear(parsed.year);
      } catch (e) {
        if (e.name === "AbortError") return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      controller.abort();
    };
  }, [query]);

  return { results, loading, clean, year };
}

export default useMovieSuggest;
