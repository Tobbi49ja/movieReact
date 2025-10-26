import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollProgress() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  const getColorByRoute = (path) => {
    if (path.includes("/movies")) return "linear-gradient(90deg, #3b82f6, #60a5fa)";
    if (path.includes("/tvshows")) return "linear-gradient(90deg, #8b5cf6, #a78bfa)";
    if (path.includes("/genres/action")) return "linear-gradient(90deg, #ef4444, #f87171)";
    if (path.includes("/genres/animation")) return "linear-gradient(90deg, #f97316, #fb923c)";
    if (path.includes("/genres/comedy")) return "linear-gradient(90deg, #22c55e, #86efac)";
    if (path.includes("/genres/drama")) return "linear-gradient(90deg, #eab308, #fde047)";
    if (path.includes("/genres/horror")) return "linear-gradient(90deg, #dc2626, #f87171)";
    if (path.includes("/search")) return "linear-gradient(90deg, #06b6d4, #67e8f9)";
    return "linear-gradient(90deg, #3b82f6, #93c5fd, white)"; // default for home
  };

  const [barColor, setBarColor] = useState(getColorByRoute(location.pathname));

  // 🧭 Watch for route change to update color
  useEffect(() => {
    setBarColor(getColorByRoute(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.body.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;

      setScrollProgress(progress);
      setIsVisible(scrollTop > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "4px",
        width: `${scrollProgress}%`,
        background: barColor,
        boxShadow: `0 0 10px ${barColor.split(",")[1] || "#3b82f6"}`,
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transition: "width 0.2s ease-out, opacity 0.4s ease, background 0.6s ease",
      }}
    />
  );
}
