import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";

import useScrollGlow from "./hooks/useScrollGlow";


// pages
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import TvShows from "./pages/TvShows";
import GenrePage from "./pages/Genres/GenrePage";
import SearchResults from "./pages/SearchResults";
import WatchPage from "./pages/WatchPage";
import TVShowWatchPage from "./pages/TVShowWatchPage";
import Sitemap from "./pages/Sitemap";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import About from "./pages/About";
import ErrorPage from "./pages/ErrorPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Watchlist from "./pages/Watchlist";
import AdminPanel from "./pages/Admin/AdminPanel";

// SEO
import SEOHelmet from "./components/seo/SEOHelmet";

function App() {
    useScrollGlow();
  return (
    <>
      {/* Global SEO defaults */}
      <SEOHelmet
        title="Tobbihub - Watch Free Movies & TV Shows Online"
        description="Stream HD movies and TV shows for free on Tobbihub. No ads, no sign-up, just entertainment."
        keywords="Tobbihub, free movies, watch TV shows online, HD streaming"
      />

      <ScrollToTop />
      <Toaster position="top-center" toastOptions={{ style: { background: "#1a1a1a", color: "#fff" } }} />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tvshows" element={<TvShows />} />
        <Route path="/search" element={<SearchResults />} />

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

      <Footer />
    </>
  );
}

export default App;
