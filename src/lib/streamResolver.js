import { registerPlugin } from "@capacitor/core";

const StreamResolver = registerPlugin("StreamResolver");

export async function resolveNative(embedUrl, { timeoutMs = 25000 } = {}) {
  if (!embedUrl || !String(embedUrl).trim()) {
    return Promise.reject(new Error("No embedUrl provided"));
  }

  if (typeof StreamResolver?.resolve !== "function") {
    return Promise.reject(new Error("Native stream resolver unavailable"));
  }

  return StreamResolver.resolve({
    embedUrl: String(embedUrl).trim(),
    timeoutMs,
  });
}

export async function cancelResolve() {
  try {
    await StreamResolver.cancel();
  } catch {}
}

export default resolveNative;
