const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

const API_BASE = `${BACKEND_URL}/api`;

const TIMEOUT_MS = 4000;
const RACE_TIMEOUT_MS = 4500;
const SLOW_RTT_MS = 2500;

export async function checkConnection() {
  if (!navigator.onLine) {
    return { ok: false, reason: "offline" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  let raceTimer = null;
  const raceTimeout = new Promise((resolve) => {
    raceTimer = setTimeout(() => resolve({ ok: false, reason: "unreachable" }), RACE_TIMEOUT_MS);
  });

  const url = `${API_BASE}/ping?t=${Date.now()}`;
  console.log("[dl-stage] netCheck fetch", url);

  try {
    const res = await Promise.race([
      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            return { ok: false, reason: "unreachable" };
          }
          const rtt = performance.now() - started;
          if (rtt > SLOW_RTT_MS) {
            return { ok: true, slow: true, rtt };
          }
          return { ok: true, slow: false, rtt };
        })
        .catch(() => ({ ok: false, reason: "unreachable" })),
      raceTimeout,
    ]);
    return res;
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
    if (raceTimer) clearTimeout(raceTimer);
  }
}
