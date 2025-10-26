import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ScrollProgress from "./components/ScrollProgress"; // ✅ NEW


// Pages
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import TvShows from "./pages/TvShows";
import Animation from "./pages/Genres/Animation";
import Action from "./pages/Genres/Action";
import Comedy from "./pages/Genres/Comedy";
import Drama from "./pages/Genres/Drama";
import Horror from "./pages/Genres/Horror";
import SearchResults from "./pages/SearchResults";
import WatchPage from "./pages/WatchPage";
import Sitemap from "./pages/Sitemap";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import About from "./pages/About";
import ErrorPage from "./pages/ErrorPage";



function App() {
  return (
    <Router>
      {/* <ScrollProgress /> ✅ Always visible at top */}
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/tvshows" element={<TvShows />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/genres/action" element={<Action />} />
        <Route path="/genres/animation" element={<Animation />} />
        <Route path="/genres/comedy" element={<Comedy />} />
        <Route path="/genres/drama" element={<Drama />} />
        <Route path="/genres/horror" element={<Horror />} />

        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/about" element={<About />} />

        <Route path="*" element={<ErrorPage />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
