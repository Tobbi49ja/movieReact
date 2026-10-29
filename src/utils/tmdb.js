export const TMDB_BASE = "https://image.tmdb.org/t/p";

const VALID_SIZES = {
  poster: ["w185", "w342", "w500", "w780"],
  backdrop: ["w300", "w780", "w1280"],
};

function px(size) {
  return parseInt(size.replace("w", ""), 10) || 0;
}

function resolveSize(size, type = "poster") {
  if (size === "original") return "original";
  const valid = VALID_SIZES[type] || VALID_SIZES.poster;
  if (valid.includes(size)) return size;
  const target = px(size);
  let best = valid[0];
  let bestDiff = Math.abs(px(valid[0]) - target);
  for (const s of valid) {
    const diff = Math.abs(px(s) - target);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best;
}

export function tmdbImg(path, size = "w342", type = "poster") {
  if (!path) return "";
  return `${TMDB_BASE}/${resolveSize(size, type)}${path}`;
}

export function tmdbImgSrcSet(path, sizes = ["w185", "w342"], type = "poster") {
  if (!path) return "";
  return sizes
    .map((s) => `${TMDB_BASE}/${resolveSize(s, type)}${path}`)
    .join(", ");
}