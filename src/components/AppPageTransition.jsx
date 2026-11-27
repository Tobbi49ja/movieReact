import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";

export default function AppPageTransition({ children }) {
  const { pathname } = useLocation();
  const isAppUI =
    typeof document !== "undefined" &&
    document.documentElement.dataset.app === "true";

  if (!isAppUI) return children;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ minHeight: "100%" }}
    >
      {children}
    </motion.div>
  );
}
