export function getSandbox(source) {
  if (!source) return undefined;
  if (source.sandbox === true) {
    return "allow-scripts allow-same-origin allow-forms allow-presentation";
  }
  try {
    const url = typeof source.url === "function" ? undefined : (source.url || source.src);
    if (url && typeof url === "string" && url.includes("?sandbox=1")) {
      return "allow-scripts allow-same-origin allow-forms allow-presentation";
    }
    if (url && typeof url === "string" && url.includes("&sandbox=1")) {
      return "allow-scripts allow-same-origin allow-forms allow-presentation";
    }
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("sandbox") === "1") {
        return "allow-scripts allow-same-origin allow-forms allow-presentation";
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

export default { getSandbox };
