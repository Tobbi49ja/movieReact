import axios from "axios";
const cache = new Map();
const inflight = new Map();
const TTL = 5 * 60 * 1000;

export function cachedAxiosGet(url, config = {}) {
  const key = url + JSON.stringify(config.params || {});
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.t < TTL) return Promise.resolve(hit.data);
  if (inflight.has(key)) return inflight.get(key);
  const ctrl = new AbortController();
  const p = axios.get(url, { ...config, signal: ctrl.signal })
    .then((res) => {
      cache.set(key, { data: res, t: Date.now() });
      inflight.delete(key);
      return res;
    })
    .catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}

export function invalidate(urlPrefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(urlPrefix)) inflight.delete(key);
  }
}