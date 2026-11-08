import { PROVIDER_ORDER, buildProviderEmbedUrl } from "./providerUrls";
import { resolveNative } from "./streamResolver";

/**
 * Resolve download candidates for a movie or episode.
 * Return contract:
 * {
 *   qualities: [{ id, label, url, bandwidth, type: "hls" | "mp4" }],
 *   subtitles: [{ id, lang, label, url }],
 *   headers: {}
 * }
 */
export async function resolveSources({ tmdbId, type, season, episode }) {
  const normalizedType = type === "tv" || type === "series" || type === "episode" ? "tv" : "movie";
  const providerDebugs = [];

  for (const provider of PROVIDER_ORDER) {
    const embedUrl = buildProviderEmbedUrl({
      provider,
      tmdbId,
      type: normalizedType,
      season,
      episode,
    });

    try {
      const result = await resolveNative(embedUrl);
      const payload = result?.value ?? result ?? {};
      const qualities = Array.isArray(payload.qualities) ? payload.qualities : [];
      const subtitles = Array.isArray(payload.subtitles) ? payload.subtitles : [];

      console.log("[resolver] result", {
        provider,
        qualityCount: qualities.length,
        subtitleCount: subtitles.length,
      });

      return { ...payload, provider };
    } catch (error) {
      const message = error?.message || String(error || "Unknown error");
      console.log("[resolver]", provider, message);

      const debugEntries = Array.isArray(error?.data?.debug)
        ? error.data.debug
        : Array.isArray(error?.debug)
          ? error.debug
          : [];

      if (debugEntries.length > 0) {
        providerDebugs.push({ provider, debug: debugEntries });
      }
    }
  }

  console.log("[resolver] debug", providerDebugs);
  throw new Error("No downloadable stream found");
}

export default resolveSources;
