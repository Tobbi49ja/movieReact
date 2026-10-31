import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import React, { Suspense, lazy } from "react";

import useScrollGlow from "./hooks/useScrollGlow";


// pages
const Home = lazy(() => import("./pages/Home"));
const Movies = lazy(() => import("./pages/Movies"));
const TvShows = lazy(() => import("./pages/TvShows"));
const GenrePage = lazy(() => import("./pages/Genres/GenrePage"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const TVShowWatchPage = lazy(() => import("./pages/TVShowWatchPage"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const Terms = lazy(() => import("./pages/Terms"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const AdminPanel = lazy(() => import("./pages/Admin/AdminPanel"));
const LiveTV = lazy(() => import("./pages/LiveTV"));

// SEO
import SEOHelmet from "./components/seo/SEOHelmet";

import UpdateMarquee from "./components/UpdateMarquee";
import BottomNav from './components/BottomNav';
import './styles/sidebar.css';

function App() {
    useScrollGlow();
  return (
    <ContentModeProvider>
      <>
        {/* Global SEO defaults */}
        <SEOHelmet
          title="Tobbihub - Watch Free Movies & TV Shows Online"
          description="Stream HD movies and TV shows for free on Tobbihub. No ads, no sign-up, just entertainment."
          keywords="Tobbihub, free movies, watch TV shows online, HD streaming"
        />

        <ScrollToTop />
        <Toaster position="top-center" toastOptions={{ style: { background: "#1a1a1a", color: "#fff" } }} />
        <Sidebar />
        <BottomNav />

        <main className="app-with-sidebar">
          <UpdateMarquee />
          <Suspense fallback={<div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#aaa'}}>Loading...</div>}>
<ErrorBoundary>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tvshows" element={<TvShows />} />
          <Route path="/search" element={<SearchResults />} />

          <Route path="/livetv" element={<LiveTV />} />

          {/* Genres */}
          <Route path="/genres/:genre" element={<GenrePage />} />

          {/* Others */}
          <Route path="/sitemap" element={<Sitemap />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/tv/:id" element={<TVShowWatchPage />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/watchlist" element={<Watchlist />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminPanel />} />

          {/* 404 */}
          <Route path="*" element={<ErrorPage />} />
          </Routes>
          </ErrorBoundary>
          </Suspense>
        <Footer />
        </main>
      </>
    </ContentModeProvider>
  );
}

export default App;