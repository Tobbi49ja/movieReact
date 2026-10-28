const cache = new Map();
const inflight = new Map();
const TTL = 5 * 60 * 1000;

export async function cachedGet(url, signal) {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.t < TTL) return hit.data;
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url, { signal }).then(async (r) => {
    const data = await r.json();
    cache.set(url, { data, t: Date.now() });
    inflight.delete(url);
    return data;
  }).catch((e) => { inflight.delete(url); throw e; });
  inflight.set(url, p);
  return p;
}
