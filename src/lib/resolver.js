/**
 * Resolve download candidates for a movie or episode.
 * Return contract:
 * {
 *   qualities: [{ id, label, url, bandwidth, type: "hls" | "mp4" }],
 *   subtitles: [{ id, lang, label, url }],
 *   headers: {}
 * }
 */
export function resolveSources({ tmdbId, type, season, episode }) {
  throw new Error("Resolver not implemented yet");
}

export default resolveSources;
