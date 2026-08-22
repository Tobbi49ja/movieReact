import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { FiBookmark } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function MovieCard({
  id,
  title,
  name,
  year,
  image,
  quality,
  mediaType,
  showBookmark = true,
}) {
  const { user, token } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);

  const displayTitle = title || name || "Untitled";

  const truncateTitle = (text, maxLength = 20) =>
    text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  // Detect the type automatically
  const type = mediaType || (title ? "movie" : "tv");

  // Dynamic link and button label
  const linkPath = type === "tv" ? `/tv/${id}` : `/watch/${id}`;
  const buttonLabel = type === "tv" ? "TV Show" : "Movie";

  // Check watchlist status on mount (only when we have an id + logged in)
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      if (!id || !user || !token) return;
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/watchlist/check/${id}?mediaType=${type}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (active) setInWatchlist(res.data.inWatchlist);
      } catch (err) {
        console.error("Error checking watchlist:", err);
      }
    };
    checkStatus();
    return () => {
      active = false;
    };
  }, [id, user, token, type]);

  const handleToggleWatchlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast("Login to save to watchlist");
      return;
    }
    if (!id) return;

    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (inWatchlist) {
        await axios.delete(
          `${BACKEND_URL}/api/watchlist/${id}?mediaType=${type}`,
          { headers }
        );
        setInWatchlist(false);
        toast.success("Removed from watchlist");
      } else {
        await axios.post(
          `${BACKEND_URL}/api/watchlist`,
          {
            tmdbId: Number(id),
            mediaType: type,
            title: displayTitle,
            poster: image,
          },
          { headers }
        );
        setInWatchlist(true);
        toast.success("Added to watchlist");
      }
    } catch (err) {
      console.error("Error toggling watchlist:", err);
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <article className="movie-card">
      <div className="img-card">
        <Link to={linkPath} aria-label={`View ${displayTitle}`} tabIndex={-1} aria-hidden="true">
          <img src={image} alt={displayTitle} loading="lazy" className="card" width="195" height="293" />
          {quality && <span className="quality-tag">{quality}</span>}
        </Link>

        {showBookmark && id && (
          <button
            className={`bookmark-btn ${inWatchlist ? "bookmarked" : ""}`}
            onClick={handleToggleWatchlist}
            aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            <FiBookmark aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="title-info">
        <h3 className="movie-title" title={displayTitle}>
          {truncateTitle(displayTitle, 20)}
        </h3>
        <p className="movie-info">{year || "Unknown"}</p>

        <Link to={linkPath} className="movie-btn" aria-label={`Watch ${displayTitle} (${buttonLabel})`}>
          {buttonLabel}
        </Link>
      </div>
    </article>
  );
}
