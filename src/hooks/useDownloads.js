import { useEffect, useState } from "react";
import { getDownloads, subscribe } from "../lib/downloads";

export default function useDownloads() {
  const [downloads, setDownloads] = useState(() => getDownloads());

  useEffect(() => {
    const unsubscribe = subscribe((next) => setDownloads(next));
    return unsubscribe;
  }, []);

  return downloads;
}
