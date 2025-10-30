import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'


import "./styles/base.css";
import "./styles/header.css";
import "./styles/hero.css";
import "./styles/movies.css";
import "./styles/watchpage.css";
import "./styles/pages.css";
import "./styles/responsive.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
