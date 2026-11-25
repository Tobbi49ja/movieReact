export const PROVIDER_SOURCES = [
  {
    id: "vidrift",
    label: "Vidrift",
    movieUrl: (id) => `https://embed.vidrift.net/embed/movie/${id}?title=true&hide=next,episodes,cast`,
    tvUrl: (id, season, episode) => `https://embed.vidrift.net/embed/tv/${id}/${season}/${episode}?title=true&hide=next,episodes,cast`,
    sandbox: false,
    downloadable: false,
  },
  {
    id: "vidfast",
    label: "Vidfast",
    movieUrl: (id) => `https://vidfast.vc/movie/${id}?autoPlay=true&pip=hide`,
    tvUrl: (id, season, episode) => `https://vidfast.vc/tv/${id}/${season}/${episode}?autoPlay=true&pip=hide`,
    sandbox: true,
    downloadable: true,
  },
  {
    id: "vidnest",
    label: "Vidnest",
    movieUrl: (id) => `https://vidnest.fun/movie/${id}`,
    tvUrl: (id, season, episode) => `https://vidnest.fun/tv/${id}/${season}/${episode}`,
    sandbox: false,
    downloadable: true,
  },
  {
    id: "vsembed",
    label: "VidSrc",
    movieUrl: (id) => `https://vsembed.su/embed/movie/${id}?autoplay=1`,
    tvUrl: (id, season, episode) => `https://vsembed.su/embed/tv/${id}/${season}/${episode}?autoplay=1`,
    sandbox: true,
    downloadable: false,
  },
];

export const PROVIDER_ORDER = ["vidfast", "vidnest"];

export function getProviderById(providerId) {
  return PROVIDER_SOURCES.find((source) => source.id === providerId) || PROVIDER_SOURCES[0];
}

export function getDownloadableProviders() {
  return PROVIDER_ORDER
    .map((orderId) => PROVIDER_SOURCES.find((source) => source.id === orderId))
    .filter((source) => source && source.downloadable === true);
}

export function getDownloadProviderId(playbackProviderId) {
  const source = PROVIDER_SOURCES.find((s) => s.id === playbackProviderId);
  if (source && source.downloadable === true) {
    return source.id;
  }
  return PROVIDER_ORDER[0];
}

export function buildProviderEmbedUrl({ provider, tmdbId, type = "movie", season, episode }) {
  const source = getProviderById(provider);
  const normalizedType = type === "tv" || type === "series" || type === "episode" ? "tv" : "movie";

  if (normalizedType === "tv") {
    return source.tvUrl(tmdbId, season, episode);
  }

  return source.movieUrl(tmdbId);
}
