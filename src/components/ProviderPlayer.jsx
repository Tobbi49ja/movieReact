import { Capacitor } from "@capacitor/core";
import { getPlayerSandbox } from "../lib/platform";

const forceSandbox = () => {
  try {
    return new URLSearchParams(window.location.search).get("sandbox") === "1";
  } catch {
    return false;
  }
};

const baseStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: "none",
};

const injectAdGuard = (iframe) => {
  try {
    iframe.contentDocument?.head?.insertAdjacentHTML("beforeend", `
      <style>
        .ad, .ads, [class*="ad-"], [class*="popup"], 
        [id*="banner"], .overlay, [class*="overlay"]:not(video),
        iframe[src*="ads"], iframe[src*="doubleclick"] {
          display: none !important;
          visibility: hidden !important;
        }
      </style>
    `);
  } catch { /* Cross-origin iframes will throw — ignore silently */ }
};

export default function ProviderPlayer({
  src,
  title,
  onLoad,
  sandbox = false,
  iframeRef,
  style,
}) {
  const handleLoad = () => {
    if (iframeRef?.current) injectAdGuard(iframeRef.current);
    if (onLoad) onLoad();
  };

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      onLoad={handleLoad}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      style={{ ...baseStyle, ...style }}
      {...(Capacitor.isNativePlatform()
        ? {}
        : sandbox || forceSandbox()
          ? { sandbox: getPlayerSandbox() }
          : {})}
    />
  );
}
