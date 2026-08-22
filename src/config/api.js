// TMDB API config
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
export const TMDB_BASE = "https://api.themoviedb.org/3";

// Build a TMDB discover URL
export const buildDiscoverUrl = ({ mediaType = "movie", genreId, language = "en-US", extraParams = "" }) => {
  const params = new URLSearchParams();
  params.set("api_key", TMDB_API_KEY);
  params.set("language", language);
  if (genreId) params.set("with_genres", genreId);
  if (extraParams) {
    extraParams.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v) params.set(k, v);
    });
  }
  return `${TMDB_BASE}/discover/${mediaType}?${params.toString()}`;
};
