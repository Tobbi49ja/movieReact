import { buildProviderEmbedUrl, getProviderById } from "./providerUrls";
import { resolveNative, cancelResolve } from "./streamResolver";

const CACHE_TTL_MS = 10 * 60 * 1000;
const RESOLVE_TIMEOUT_MS = 25000;

const cache = new Map();
const inflight = new Map();

const cacheKey = (providerId, embedUrl) => `${providerId}::${embedUrl}`;

const normalizeType = (type) =>
  type === "tv" || type === "series" || type === "episode" ? "tv" : "movie";

export function invalidateResolveCache(providerId, embedUrl) {
  if (!providerId || !embedUrl) return;
  cache.delete(cacheKey(providerId, embedUrl));
}

export function clearResolveCache() {
  cache.clear();
}

export function isResolveInFlight(providerId, embedUrl) {
  if (!providerId || !embedUrl) return false;
  return inflight.has(cacheKey(providerId, embedUrl));
}

/**
 * Resolve download candidates for a movie or episode using one provider.
 * Contract:
 * {
 *   qualities: [{ id, label, url, bandwidth, type: "hls" | "mp4" }],
 *   subtitles: [{ id, lang, label, url }],
 *   headers: {},
 *   provider, providerId, embedUrl
 * }
 */
export async function resolveForProvider(providerId, media = {}, { signal } = {}) {
  const source = getProviderById(providerId);
  const embedUrl = buildProviderEmbedUrl({
    provider: source.id,
    tmdbId: media.tmdbId,
    type: normalizeType(media.type),
    season: media.season,
    episode: media.episode,
  });

  const key = cacheKey(source.id, embedUrl);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) cache.delete(key);

  if (signal?.aborted) {
    throw new Error("Cancelled");
  }

  // Join an in-flight scan (e.g. a background prefetch) instead of starting a second one.
  // Joiners never wire cancellation, so they can't preempt the running scan.
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  let handleAbort = null;
  const run = async () => {
    handleAbort = () => {
      cancelResolve();
    };
    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      const result = await resolveNative(embedUrl, { timeoutMs: RESOLVE_TIMEOUT_MS });
      if (signal?.aborted) {
        throw new Error("Cancelled");
      }

      const payload = result?.value ?? result ?? {};
      const qualities = Array.isArray(payload.qualities) ? payload.qualities : [];
      const subtitles = Array.isArray(payload.subtitles) ? payload.subtitles : [];

      console.log("[resolver] result", {
        provider: source.id,
        qualityCount: qualities.length,
        subtitleCount: subtitles.length,
      });

      if (qualities.length === 0) {
        throw new Error("No downloadable stream found");
      }

      const finalResult = {
        ...payload,
        qualities,
        subtitles,
        provider: source.id,
        providerId: source.id,
        embedUrl,
      };

      cache.set(key, { result: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
      return finalResult;
    } finally {
      if (handleAbort) signal?.removeEventListener("abort", handleAbort);
    }
  };

  const promise = run();
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export default resolveForProvider;
