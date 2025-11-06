import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";

// pages
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import TvShows from "./pages/TvShows";
import Animation from "./pages/Genres/Animation";
import Action from "./pages/Genres/Action";
import Comedy from "./pages/Genres/Comedy";
import Drama from "./pages/Genres/Drama";
import Horror from "./pages/Genres/Horror";
import Anime from "./pages/Genres/Anime";
import SearchResults from "./pages/SearchResults";
import WatchPage from "./pages/WatchPage";
import TVShowWatchPage from "./pages/TVShowWatchPage";
import Sitemap from "./pages/Sitemap";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import About from "./pages/About";
import ErrorPage from "./pages/ErrorPage";

// SEO
import SEOHelmet from "./components/seo/SEOHelmet";

function App() {
  return (
    <>
      {/* Global SEO defaults */}
      <SEOHelmet
        title="Tobbihub - Watch Free Movies & TV Shows Online"
        description="Stream HD movies and TV shows for free on Tobbihub. No ads, no sign-up, just entertainment."
        keywords="Tobbihub, free movies, watch TV shows online, HD streaming"
      />

      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tvshows" element={<TvShows />} />
        <Route path="/search" element={<SearchResults />} />

        {/* Genres */}
        <Route path="/genres/action" element={<Action />} />
        <Route path="/genres/animation" element={<Animation />} />
        <Route path="/genres/comedy" element={<Comedy />} />
        <Route path="/genres/drama" element={<Drama />} />
        <Route path="/genres/horror" element={<Horror />} />
        <Route path="/genres/anime" element={<Anime />} />

        {/* Others */}
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/tv/:id" element={<TVShowWatchPage />} />

        {/* 404 */}
        <Route path="*" element={<ErrorPage />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
