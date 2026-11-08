import { registerPlugin } from "@capacitor/core";

const MediaSniffer = registerPlugin("MediaSniffer");

export function startSniffing() {
  if (typeof MediaSniffer?.start === "function") {
    return MediaSniffer.start();
  }
  return Promise.resolve();
}

export function stopSniffing() {
  if (typeof MediaSniffer?.stop === "function") {
    return MediaSniffer.stop();
  }
  return Promise.resolve();
}

export async function getFound() {
  if (typeof MediaSniffer?.getFound === "function") {
    const result = await MediaSniffer.getFound();
    return result?.items ?? result ?? [];
  }
  return [];
}

export function onStreamFound(cb) {
  if (typeof cb !== "function") {
    return () => {};
  }

  const listener = MediaSniffer.addListener("streamFound", (event) => {
    cb(event);
  });

  return () => {
    if (typeof listener?.remove === "function") {
      listener.remove();
    }
  };
}
