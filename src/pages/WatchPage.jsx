// src/pages/WatchPage.jsx
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
import SEOHelmet from "../components/seo/SEOHelmet";
import AdNoticeMarquee from "../components/AdNoticeMarquee";
import VPNBanner from "../components/VPNBanner";

// -----------------------------
// Dynamic backend URL
// -----------------------------
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "https://moviereact-backend.onrender.com");

export default function WatchPage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [currentSource, setCurrentSource] = useState("");
  const [deviceType, setDeviceType] = useState("");

  const socketRef = useRef(null);
  const trailerRef = useRef(null);
  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // -----------------------------
  // Sources
  // -----------------------------
  const sources = {
    VidSrc: `https://vidsrc.to/embed/movie/${id}`,
    AutoEmbed: `https://autoembed.cc/embed/movie/${id}`,
    SmashyStream: `https://smashystream.com/embed/movie/${id}`,
    MovieAPI: `https://movieapi.club/embed/movie/${id}`,
  };

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
  // Fetch Movie Details + trailer
  // -----------------------------
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const [res, videosRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US`
          ),
          fetch(
            `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=en-US`
          ),
        ]);

        const data = await res.json();
        const videos = await videosRes.json();
        setMovie(data);

        const trailer = videos.results?.find(
          (vid) => vid.type === "Trailer" && vid.site === "YouTube"
        );
        if (trailer) setTrailerKey(trailer.key);

        setCurrentSource(Object.values(sources)[0]);
      } catch (err) {
        console.error("Error fetching movie:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id, TMDB_KEY]);

  // -----------------------------
  // Fetch comments
  // -----------------------------
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/comments/movie/${id}`);
        setComments(res.data.reverse());
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

    socket.emit("join_room", { contentId: id, contentType: "movie" });

    socket.on("new_comment", (comment) => {
      setComments((prev) => [comment, ...prev]);
    });

    socket.on("comment_liked", (updatedComment) => {
      setComments((prev) =>
        prev.map((c) => (c._id === updatedComment._id ? updatedComment : c))
      );
    });

    return () => {
      socket.emit("leave_room", { contentId: id, contentType: "movie" });
      socket.off("new_comment");
      socket.off("comment_liked");
      socket.disconnect();
    };
  }, [id]);

  // -----------------------------
  // Handlers
  // -----------------------------
  const handleLike = () => setLikes((prev) => prev + 1);
  const handleDislike = () => setDislikes((prev) => prev + 1);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`${BACKEND_URL}/api/comments`, {
        contentId: id,
        contentType: "movie",
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

  const handleTrailerToggle = () => {
    setShowTrailer((prev) => !prev);
    if (!showTrailer && trailerRef.current) {
      trailerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading) return <Loader />;
  if (!movie) return <p className="loading">Movie not found.</p>;

  return (
    <main id="main-content" className="watch-page pulldown2">
      <SEOHelmet item={movie} url={`https://moviereact-zzye.onrender.com/watch/${id}`} />
      <AdNoticeMarquee />

      <div className="watch-sticky-info">
        <h1>{movie.title}</h1>
        <p className="watch-meta">
          <strong>Release:</strong> {movie.release_date} |{" "}
          <strong>Rating:</strong> {movie.vote_average?.toFixed(1)}
        </p>
      </div>

      <div className="watch-hero">
        <img
          src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
          alt={movie.title}
          className="watch-bg"
        />
        <div className="watch-overlay">
          <p>{movie.overview}</p>
        </div>
      </div>

      {/* Player Section */}
      <div className="watch-player">
        <h2>Now Playing</h2>
        <div className="source-buttons">
          {Object.entries(sources).map(([name, url]) => (
            <button
              key={name}
              className={`source-btn ${currentSource === url ? "active-source" : ""}`}
              onClick={() => setCurrentSource(url)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="video-container">
          <iframe
            src={currentSource}
            title="Movie Player"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            style={{ border: "none" }}
          />
        </div>
      </div>

      <VPNBanner />

      {/* Reactions */}
      <div className="reaction-section" aria-label="Movie reactions">
        <button className="reaction-btn" onClick={handleLike} aria-label={`Like this movie, ${likes} likes`}>
          <FiThumbsUp aria-hidden="true" /> <span>{likes}</span>
        </button>
        <button className="reaction-btn" onClick={handleDislike} aria-label={`Dislike this movie, ${dislikes} dislikes`}>
          <FiThumbsDown aria-hidden="true" /> <span>{dislikes}</span>
        </button>
      </div>

      {/* Trailer Section */}
      <div className="watch-trailer" ref={trailerRef}>
        <button className="trailer-toggle" onClick={handleTrailerToggle}>
          {showTrailer ? <>Hide Trailer <FiChevronUp /></> : <>Watch Trailer <FiChevronDown /></>}
        </button>
        {showTrailer && trailerKey && (
          <iframe
            width="100%"
            height="400"
            src={`https://www.youtube.com/embed/${trailerKey}`}
            title={`${movie.title} trailer`}
            allowFullScreen
            className="trailer-iframe"
          />
        )}
        {showTrailer && !trailerKey && <p className="no-trailer">Trailer not available.</p>}
      </div>

      {/* Comments Section */}
      <section className="comment-section" aria-label="Comments">
        <h2>Comments</h2>
        <form onSubmit={handleCommentSubmit} className="comment-form">
          <label htmlFor="comment-input" className="sr-only">Add a comment</label>
          <input
            id="comment-input"
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="comment-input"
            maxLength={500}
          />
          <button type="submit" className="comment-btn">Post</button>
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
