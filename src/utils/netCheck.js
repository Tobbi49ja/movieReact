const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

const API_BASE = `${BACKEND_URL}/api`;

const TIMEOUT_MS = 3000;
const RACE_TIMEOUT_MS = 3500;
const SLOW_RTT_MS = 2500;
const FAST_FAIL_MS = 1500;

// Only a definite offline signal should block a scan:
//   - navigator.onLine === false
//   - a fetch that fails fast with a network error
// A timeout / slow response is treated as "online but slow" and lets the scan proceed.
export async function checkConnection() {
  if (!navigator.onLine) {
    return { ok: false, reason: "offline" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  let raceTimer = null;
  const raceTimeout = new Promise((resolve) => {
    raceTimer = setTimeout(() => {
      const rtt = performance.now() - started;
      resolve({ ok: true, slow: true, rtt, timedOut: true });
    }, RACE_TIMEOUT_MS);
  });

  const url = `${API_BASE}/ping?t=${Date.now()}`;
  console.log("[dl-stage] netCheck fetch", url);

  try {
    const res = await Promise.race([
      fetch(url, { signal: controller.signal })
        .then((response) => {
          const rtt = performance.now() - started;
          // Reached the server — the network is up regardless of status code.
          return { ok: true, slow: rtt > SLOW_RTT_MS, rtt };
        })
        .catch((err) => {
          const rtt = performance.now() - started;
          const aborted = err?.name === "AbortError";
          if (aborted || rtt >= FAST_FAIL_MS) {
            // Timed out or failed slowly — don't block; proceed as slow/online.
            return { ok: true, slow: true, rtt, timedOut: aborted };
          }
          // Fast network error — definite failure.
          return { ok: false, reason: "unreachable", rtt };
        }),
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
