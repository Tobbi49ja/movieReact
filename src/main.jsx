import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { isNativeApp } from "./utils/platform";

if (isNativeApp()) {
  document.body.classList.add("is-app");
}

// Debug console (opt-in)
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") localStorage.setItem("tb_debug", "1");
  if (params.get("debug") === "0") localStorage.removeItem("tb_debug");
} catch {}
if (localStorage.getItem("tb_debug") === "1") {
  try {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.js";
    sc.onload = () => { try { window.eruda && window.eruda.init(); } catch {} };
    document.head.appendChild(sc);
  } catch {}
}

// your styles
import "./styles/base.css";
import "./styles/components.css";
import "./styles/footer.css";
import "./styles/header.css";
import "./styles/hero.css";
import "./styles/movies.css";
import "./styles/pages.css";
import "./styles/preview.css";
import "./styles/responsive.css";
import "./styles/tvshow.css";
import "./styles/watchpage.css";
import "./styles/auth.css";
import "./styles/admin.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
