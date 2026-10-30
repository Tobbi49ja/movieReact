import { cachedAxiosGet } from "./cachedAxios";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

let cached = null;

export async function fetchAppConfig() {
  try {
    const res = await cachedAxiosGet(`${BACKEND_URL}/api/app-config`);
    cached = res.data?.data || null;
    return cached;
  } catch {
    return null;
  }
}

export function getAppConfigSync() {
  return cached;
}