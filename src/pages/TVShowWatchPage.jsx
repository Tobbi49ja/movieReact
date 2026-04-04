// src/pages/TVShowWatchPage.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Loader from "../components/Loader";
import {
  FiChevronDown,
  FiChevronUp,
  FiThumbsUp,
  FiThumbsDown,
} from "react-icons/fi";
import AdNoticeMarquee from "../components/AdNoticeMarquee";
import SEOHelmet from "../components/seo/SEOHelmet";
import VPNBanner from "../components/VPNBanner";

// -----------------------------
// Dynamic backend URL
// -----------------------------
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "https://moviereact-backend.onrender.com");

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
  const [deviceType, setDeviceType] = useState("");
  const [currentSource, setCurrentSource] = useState("");

  const socketRef = useRef(null);
  const trailerRef = useRef(null);

  // -----------------------------
  // Detect device type
  // -----------------------------
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android"))
      setDeviceType("android_user_" + Math.floor(Math.random() * 1000));
    else if (ua.includes("iphone"))
      setDeviceType("iphone_user_" + Math.floor(Math.random() * 1000));
    else if (ua.includes("samsung"))
      setDeviceType("samsung_user_" + Math.floor(Math.random() * 1000));
    else setDeviceType("user_" + Math.floor(Math.random() * 1000));
  }, []);

  // -----------------------------
  // Sources
  // -----------------------------
  const sources = (season, episode) => ({
    VidSrc: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
    AutoEmbed: `https://autoembed.cc/embed/tv/${id}/${season}/${episode}`,
    SmashyStream: `https://smashystream.com/embed/tv/${id}/${season}/${episode}`,
    MovieAPI: `https://movieapi.club/embed/tv/${id}/${season}/${episode}`,
  });

  // -----------------------------
  // Fetch show details + trailer
  // -----------------------------
  useEffect(() => {
    const fetchShow = async () => {
      try {
        const [showRes, videosRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&language=en-US`
          ),
          fetch(
            `https://api.themoviedb.org/3/tv/${id}/videos?api_key=${API_KEY}&language=en-US`
          ),
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

  // -----------------------------
  // Fetch episodes for selected season
  // -----------------------------
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

        if (data.episodes?.[0]) {
          const firstEp = data.episodes[0];
          const firstSource = Object.values(
            sources(selectedSeason, firstEp.episode_number)
          )[0];
          setCurrentSource(firstSource);
        }
      } catch (err) {
        console.error("Error fetching episodes:", err);
      } finally {
        setLoading(false);
      }
    };
    if (selectedSeason) fetchEpisodes();
  }, [selectedSeason, id, API_KEY]);

  // -----------------------------
  // Fetch comments
  // -----------------------------
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/comments/tv/${id}`);
        setComments(res.data);
      } catch (err) {
        console.error("Error loading comments:", err);
      }
    };
    fetchComments();
  }, [id]);

  // -----------------------------
  // Socket.io live updates
  // -----------------------------
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("join_room", { contentId: id, contentType: "tv" });

    socket.on("new_comment", (comment) => {
      setComments((prev) => [comment, ...prev]);
    });

    socket.on("comment_liked", (updatedComment) => {
      setComments((prev) =>
        prev.map((c) => (c._id === updatedComment._id ? updatedComment : c))
      );
    });

    return () => {
      socket.emit("leave_room", { contentId: id, contentType: "tv" });
      socket.off("new_comment");
      socket.off("comment_liked");
      socket.disconnect();
    };
  }, [id]);

  // -----------------------------
  // Handlers
  // -----------------------------
  const handleTrailerToggle = () => {
    setShowTrailer((prev) => !prev);
    if (!showTrailer && trailerRef.current) {
      trailerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`${BACKEND_URL}/api/comments`, {
        contentId: id,
        contentType: "tv",
        username: deviceType,
        comment: newComment,
      });

      socketRef.current?.emit("send_comment", res.data);
      setNewComment("");
      setComments((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/comments/like/${commentId}`
      );
      socketRef.current?.emit("like_comment", res.data);
    } catch (err) {
      console.error("Error liking comment:", err);
    }
  };

  if (loading || !show) return <Loader />;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <main id="main-content" className="watch-page pulldown2">
      <SEOHelmet item={show} url={`https://moviereact-zzye.onrender.com/tv/${id}`} />
      <AdNoticeMarquee />

      <div className="watch-sticky-info">
        <h1 className="watch-title">{show.name}</h1>
        <p className="watch-meta">
          <strong>First Air Date:</strong> {show.first_air_date} |{" "}
          <strong>Rating:</strong> {show.vote_average?.toFixed(1)}
        </p>
      </div>

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

      <div className="season-selector">
        <label htmlFor="season-select">Select Season:</label>
        <select
          id="season-select"
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(Number(e.target.value))}
          aria-label="Select TV show season"
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.season_number}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      <div className="episodes-section">
        <h2>Episodes</h2>
        <div className="episodes-grid">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className={`episode-card ${
                selectedEpisode?.id === ep.id ? "active" : ""
              }`}
              onClick={() => {
                setSelectedEpisode(ep);
                setCurrentSource(
                  Object.values(sources(selectedSeason, ep.episode_number))[0]
                );
              }}
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

      {selectedEpisode && (
        <div className="watch-player">
          <h2>Now Playing</h2>
          <div className="source-buttons">
            {Object.entries(
              sources(selectedSeason, selectedEpisode.episode_number)
            ).map(([name, url]) => (
              <button
                key={name}
                className={`source-btn ${
                  currentSource === url ? "active-source" : ""
                }`}
                onClick={() => setCurrentSource(url)}
              >
                {name}
              </button>
            ))}
          </div>
          <iframe
            src={currentSource}
            width="100%"
            height="500"
            frameBorder="0"
            allowFullScreen
            title={`Episode ${selectedEpisode.episode_number}`}
          />
        </div>
      )}

      <VPNBanner />

      <div className="reaction-section" aria-label="Show reactions">
        <button className="reaction-btn" onClick={() => setLikes(likes + 1)} aria-label={`Like this show, ${likes} likes`}>
          <FiThumbsUp aria-hidden="true" /> <span>{likes}</span>
        </button>
        <button
          className="reaction-btn"
          onClick={() => setDislikes(dislikes + 1)}
          aria-label={`Dislike this show, ${dislikes} dislikes`}
        >
          <FiThumbsDown aria-hidden="true" /> <span>{dislikes}</span>
        </button>
      </div>

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
          />
        )}
        {showTrailer && !trailerKey && (
          <p className="no-trailer">Trailer not available.</p>
        )}
      </div>

      <section className="comment-section" aria-label="Comments">
        <h2>Comments</h2>
        <form onSubmit={handleCommentSubmit} className="comment-form">
          <label htmlFor="tv-comment-input" className="sr-only">Add a comment</label>
          <input
            id="tv-comment-input"
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="comment-input"
            maxLength={500}
          />
          <button type="submit" className="comment-btn">
            Post
          </button>
        </form>

        <div className="comment-list" aria-live="polite" aria-label="Comments list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="comment-item">
                <strong>{c.username}</strong>
                <p>{c.comment}</p>
                <button
                  onClick={() => handleLikeComment(c._id)}
                  aria-label={`Like comment by ${c.username}, ${c.likes || 0} likes`}
                >
                  ❤️ {c.likes || 0}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
