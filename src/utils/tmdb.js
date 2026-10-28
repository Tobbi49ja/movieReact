export const TMDB_BASE = "https://image.tmdb.org/t/p";

export function tmdbImg(path, size = "w342") {
  if (!path) return "";
  return `${TMDB_BASE}/${path}`;
}

export function tmdbImgSrcSet(path, sizes = ["w185", "w342"]) {
  if (!path) return "";
  return sizes.map((s) => `${TMDB_BASE}/${s}${path}`).join(", ");
}
