import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FaStar } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

export default function StarRating({ tmdbId, mediaType = "movie" }) {
  const { user, token } = useAuth();
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [ownRating, setOwnRating] = useState(null);
  const [hover, setHover] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRatings = async () => {
    try {
      const [avgRes, ownRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/ratings/${tmdbId}?mediaType=${mediaType}`),
        user && token
          ? axios.get(`${BACKEND_URL}/api/ratings/${tmdbId}/me?mediaType=${mediaType}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : Promise.resolve({ data: { rating: null } }),
      ]);
      setAverage(avgRes.data.average || 0);
      setCount(avgRes.data.count || 0);
      setOwnRating(ownRes.data.rating || null);
    } catch (err) {
      console.error("Error fetching ratings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tmdbId) fetchRatings();
  }, [tmdbId, mediaType, user]);

  const handleRate = async (score) => {
    if (!user) return;
    try {
      await axios.post(
        `${BACKEND_URL}/api/ratings`,
        { tmdbId: Number(tmdbId), mediaType, score },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`You rated this ${score}/5`);
      fetchRatings();
    } catch (err) {
      console.error("Error submitting rating:", err);
      toast.error(err.response?.data?.message || "Failed to save rating");
    }
  };

  if (loading) return null;

  const displayValue = user ? ownRating || hover || average : average;

  return (
    <div className="star-rating" aria-label="Rating section">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star ${star <= Math.round(displayValue) ? "active" : ""} ${
              user && ownRating === star ? "own" : ""
            }`}
            onClick={() => user && handleRate(star)}
            onMouseEnter={() => user && setHover(star)}
            onMouseLeave={() => setHover(null)}
            disabled={!user}
            aria-label={user ? `Rate ${star} out of 5` : `Average rating ${star} out of 5`}
            aria-pressed={user ? ownRating === star : undefined}
          >
            <FaStar aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="rating-info">
        {user ? (
          ownRating ? (
            <>Your rating: <strong>{ownRating}/5</strong> · Average: {average.toFixed(1)}/5 ({count} {count === 1 ? "rating" : "ratings"})</>
          ) : (
            <>Average: {average.toFixed(1)}/5 ({count} {count === 1 ? "rating" : "ratings"}) — click a star to rate</>
          )
        ) : (
          <>Average: {average.toFixed(1)}/5 ({count} {count === 1 ? "rating" : "ratings"}) — login to rate</>
        )}
      </p>
    </div>
  );
}
