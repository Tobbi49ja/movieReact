import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import MovieCard from "../components/MovieCard";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import SEOHelmet from "../components/seo/SEOHelmet";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function Watchlist() {
  const { user, token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchWatchlist = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/watchlist`, {
        headers: authHeaders,
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching watchlist:", err);
      toast.error("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchWatchlist();
  }, [user]);

  const handleRemove = async (item) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/api/watchlist/${item.tmdbId}?mediaType=${item.mediaType}`,
        { headers: authHeaders }
      );
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      toast.success("Removed from watchlist");
    } catch (err) {
      console.error("Error removing item:", err);
      toast.error("Failed to remove item");
    }
  };

  return (
    <main id="main-content" className="watchlist-page pulldown2">
      <SEOHelmet
        title="My Watchlist - Tobbihub"
        description="Your saved movies and TV shows on Tobbihub."
      />

      <h1 className="section-title">My Watchlist</h1>

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <div className="watchlist-empty">
          <p>Your watchlist is empty.</p>
          <p>Browse movies and TV shows and tap the bookmark icon to save them here.</p>
          <Link to="/movies" className="auth-btn browse-btn">Browse Movies</Link>
        </div>
      ) : (
        <div className="watchlist-grid">
          {items.map((item) => (
            <div key={item._id} className="watchlist-item">
              <MovieCard
                id={item.tmdbId}
                title={item.title}
                image={item.poster}
                mediaType={item.mediaType}
                showBookmark={false}
              />
              <button
                className="watchlist-remove-btn"
                onClick={() => handleRemove(item)}
                aria-label={`Remove ${item.title} from watchlist`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
