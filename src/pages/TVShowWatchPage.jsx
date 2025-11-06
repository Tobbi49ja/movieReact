// src/pages/TVShowWatchPage.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import Loader from "../components/Loader";
import { FiChevronDown, FiChevronUp, FiThumbsUp, FiThumbsDown } from "react-icons/fi";
import AdNoticeMarquee from "../components/AdNoticeMarquee";
export default function TVShowWatchPage() {
  const { id } = useParams();
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  const [show, setShow] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const trailerRef = useRef(null);

  // Fetch show details + trailer
  useEffect(() => {
    const fetchShow = async () => {
      try {
        const [showRes, videosRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/tv/${id}/videos?api_key=${API_KEY}&language=en-US`)
        ]);

        const showData = await showRes.json();
        const videoData = await videosRes.json();

        setShow(showData);
        setSeasons(showData.seasons || []);
        setSelectedSeason(showData.seasons?.[0]?.season_number || 1);

        const trailer = videoData.results?.find(
          (vid) => vid.type === "Trailer" && vid.site === "YouTube"
        );
        if (trailer) setTrailerKey(trailer.key);
      } catch (err) {
        console.error("Error fetching TV show:", err);
      }
    };
    fetchShow();
  }, [id, API_KEY]);

  // Fetch episodes for selected season
  useEffect(() => {
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${id}/season/${selectedSeason}?api_key=${API_KEY}&language=en-US`
        );
        const data = await res.json();
        setEpisodes(data.episodes || []);
        setSelectedEpisode(data.episodes?.[0] || null);
      } catch (err) {
        console.error("Error fetching episodes:", err);
      } finally {
        setLoading(false);
      }
    };
    if (selectedSeason) fetchEpisodes();
  }, [selectedSeason, id, API_KEY]);

  if (loading || !show) return <Loader />;

  const streamUrl = selectedEpisode
    ? `https://vidsrc.to/embed/tv/${id}/${selectedSeason}/${selectedEpisode.episode_number}`
    : null;

  const handleTrailerToggle = () => {
    setShowTrailer((prev) => !prev);
    if (!showTrailer && trailerRef.current) {
      trailerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment.trim()]);
      setNewComment("");
    }
  };

  return (
    <main className="watch-page pulldown2">
            <AdNoticeMarquee />
      {/* Sticky Info */}
      <div className="watch-sticky-info">
        <h1 className="watch-title">{show.name}</h1>
        <p className="watch-meta">
          <strong>First Air Date:</strong> {show.first_air_date} |{" "}
          <strong>Rating:</strong> {show.vote_average?.toFixed(1)}
        </p>
      </div>

      {/* 🎥 Hero Preview Section */}
      <div className="watch-hero">
        <img
          src={`https://image.tmdb.org/t/p/original${show.backdrop_path}`}
          alt={show.name}
          className="watch-bg"
        />
        <div className="watch-overlay">
          <p>{show.overview}</p>
        </div>
      </div>

      {/* 🎬 Video Player */}
      {streamUrl && (
        <div className="video-container">
          <iframe
            src={streamUrl}
            allowFullScreen
            title={show.name}
            frameBorder="0"
          ></iframe>
        </div>
      )}

      {/* 📺 Season Selector */}
      <div className="season-selector">
        <label>Select Season:</label>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(Number(e.target.value))}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.season_number}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {/* 🎞 Episodes Section */}
      <div className="episodes-section">
        <h2>Episodes</h2>
        <div className="episodes-grid">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className={`episode-card ${
                selectedEpisode?.id === ep.id ? "active" : ""
              }`}
              onClick={() => setSelectedEpisode(ep)}
            >
              <img
                src={
                  ep.still_path
                    ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                    : "https://via.placeholder.com/300x169?text=No+Image"
                }
                alt={ep.name}
              />
              <p className="ep-title">
                E{ep.episode_number}: {ep.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 👍 Reactions */}
      <div className="reaction-section">
        <button className="reaction-btn" onClick={() => setLikes(likes + 1)}>
          <FiThumbsUp /> {likes}
        </button>
        <button className="reaction-btn" onClick={() => setDislikes(dislikes + 1)}>
          <FiThumbsDown /> {dislikes}
        </button>
      </div>

      {/* 🎬 Trailer Preview */}
      <div className="watch-trailer" ref={trailerRef}>
        <button className="trailer-toggle" onClick={handleTrailerToggle}>
          {showTrailer ? (
            <>
              Hide Trailer <FiChevronUp />
            </>
          ) : (
            <>
              Watch Trailer <FiChevronDown />
            </>
          )}
        </button>

        {showTrailer && trailerKey && (
          <iframe
            width="100%"
            height="400"
            src={`https://www.youtube.com/embed/${trailerKey}`}
            title={`${show.name} Trailer`}
            allowFullScreen
            className="trailer-iframe"
          ></iframe>
        )}
        {showTrailer && !trailerKey && (
          <p className="no-trailer">Trailer not available.</p>
        )}
      </div>

      {/* 💬 Comments */}
      <div className="comment-section">
        <h2>Comments</h2>
        <form onSubmit={handleCommentSubmit} className="comment-form">
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="comment-input"
          />
          <button type="submit" className="comment-btn">
            Post
          </button>
        </form>

        <div className="comment-list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment, index) => (
              <div key={index} className="comment-item">
                <span>💬 {comment}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
