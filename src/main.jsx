import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { isNativeApp } from "./utils/platform";
import { isApp } from "./lib/platform";

const devForce = import.meta.env.DEV && (new URLSearchParams(location.search).get("app") === "1" || sessionStorage.getItem("forceApp") === "1");
if (devForce) sessionStorage.setItem("forceApp", "1");
if (isApp || devForce) document.documentElement.setAttribute("data-app", "true");

if (isNativeApp()) {
  try {
    document.body.classList.add("is-app");
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {}
    })();
  } catch {}
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

import '@fontsource-variable/inter';

// your styles
import "./styles/tailwind.css";
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
import "./styles/app-theme.css";
import "./styles/app-pill.css";
import "./styles/app-cards.css";
import "./styles/app-hero.css";
import "./styles/app-watch.css";
import "./styles/app-pages.css";
import "./styles/app-admin.css";
import "./styles/app-settings.css";
import "./styles/app-notifications.css";

// Microsoft Clarity (opt-in via env)
const clarityId = import.meta.env.VITE_CLARITY_ID;
if (clarityId) {
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", clarityId);
}
const root = createRoot(document.getElementById("root"));
const doRender = () => {
  root.render(
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
};

try {
  if (isNativeApp() && !sessionStorage.getItem("tb_welcomed")) {
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {}
      setTimeout(() => {
        try { sessionStorage.setItem("tb_welcomed", "1"); } catch {}
        doRender();
      }, 2500);
    })();
  } else {
    doRender();
  }
} catch {
  doRender();
}
