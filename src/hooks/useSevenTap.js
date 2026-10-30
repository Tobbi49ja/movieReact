import { useRef } from "react";

export function useSevenTap() {
  const tapsRef = useRef({ count: 0, first: 0 });

  const handleTap = () => {
    try {
      const now = Date.now();
      const t = tapsRef.current;
      if (now - t.first > 4000) { t.first = now; t.count = 0; }
      t.count += 1;
      if (t.count >= 7) {
        t.count = 0;
        if (localStorage.getItem("tb_debug") === "1") localStorage.removeItem("tb_debug");
        else localStorage.setItem("tb_debug", "1");
        window.location.reload();
      }
    } catch { /* ignore */ }
  };

  return handleTap;
}
