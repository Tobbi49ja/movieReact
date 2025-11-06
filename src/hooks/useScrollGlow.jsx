import { useEffect } from "react";

export default function useScrollGlow() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.body.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight ? scrollTop / docHeight : 0;

      // Glow intensity from 5px to 20px
      const glow = 5 + scrollPercent * 15;
      document.documentElement.style.setProperty("--scroll-glow", `${glow}px`);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
}
