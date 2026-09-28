import { createContext, useContext, useState, useEffect } from "react";

const MODE_KEY = "tobbihub_content_mode";

const ContentModeContext = createContext(null);

export function ContentModeProvider({ children }) {
  const [mode, setMode] = useState("hollywood");

  // Persist to localStorage so preference survives refresh
  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "hollywood" || stored === "nollywood") {
      setMode(stored);
    }
  }, []);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "hollywood" ? "nollywood" : "hollywood";
      localStorage.setItem(MODE_KEY, next);
      return next;
    });
  };

  const setContentMode = (newMode) => {
    if (newMode !== "hollywood" && newMode !== "nollywood") return;
    setMode(newMode);
    localStorage.setItem(MODE_KEY, newMode);
  };

  return (
    <ContentModeContext.Provider value={{ mode, toggleMode, setMode: setContentMode }}>
      {children}
    </ContentModeContext.Provider>
  );
}

export function useContentMode() {
  const ctx = useContext(ContentModeContext);
  if (!ctx) throw new Error("useContentMode must be used within ContentModeProvider");
  return ctx;
}