import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.jsx";

// your styles
import "./styles/base.css";
import "./styles/components.css";
import "./styles/footer.css";
import "./styles/header.css";
import "./styles/hero.css";
import "./styles/movies.css";
import "./styles/pages.css";
import "./styles/pages.css";
import "./styles/preview.css";
import "./styles/responsive.css";
import "./styles/tvshow.css";
import "./styles/watchpage.css";
import "./styles/responsive.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
