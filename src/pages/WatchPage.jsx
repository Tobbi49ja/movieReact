// src/pages/WatchPage.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import Loader from "../components/Loader";
import {
  FiChevronDown,
  FiChevronUp,
  FiThumbsUp,
  FiThumbsDown,
} from "react-icons/fi";
import SEOHelmet from "../components/seo/SEOHelmet";
import AdNoticeMarquee from "../components/AdNoticeMarquee";

// change when hosting reminder!!!!
const socket = io("http://localhost:5000"); 
// change when hosting reminder!!!

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

  const trailerRef = useRef(null);
  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

  const sources = {
    VidSrc: `https://vidsrc.to/embed/movie/${id}`,
    AutoEmbed: `https://autoembed.cc/embed/movie/${id}`,
    SmashyStream: `https://smashystream.com/embed/movie/${id}`,
    MovieAPI: `https://movieapi.club/embed/movie/${id}`,
  };

  // Detect device type for username
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) setDeviceType("android_user_" + Math.floor(Math.random() * 1000));
    else if (ua.includes("iphone")) setDeviceType("iphone_user_" + Math.floor(Math.random() * 1000));
    else if (ua.includes("samsung")) setDeviceType("samsung_user_" + Math.floor(Math.random() * 1000));
    else setDeviceType("user_" + Math.floor(Math.random() * 1000));
  }, []);

  // Fetch Movie Details
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const [res, videosRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=en-US`),
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

  // Fetch existing comments (newest first)
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/comments/${id}`);
        setComments(res.data.reverse()); // newest on top
      } catch (err) {
        console.error("Error loading comments:", err);
      }
    };
    fetchComments();
  }, [id]);

  // Listen for live comment updates from Socket.io
  useEffect(() => {
    socket.emit("join_movie_room", id);

    socket.on("new_comment", (comment) => {
      setComments((prev) => [comment, ...prev]); // prepend new comment
    });

    socket.on("comment_liked", (updatedComment) => {
      setComments((prev) =>
        prev.map((c) => (c._id === updatedComment._id ? updatedComment : c))
      );
    });

    return () => {
      socket.emit("leave_movie_room", id);
      socket.off("new_comment");
      socket.off("comment_liked");
    };
  }, [id]);

  // Likes & Dislikes
  const handleLike = () => setLikes((prev) => prev + 1);
  const handleDislike = () => setDislikes((prev) => prev + 1);

  // Submit new comment
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post("http://localhost:5000/api/comments", {
        movieId: id,
        comment: newComment,
        deviceType,
      });

      socket.emit("send_comment", res.data); // broadcast live
      setNewComment("");
      setComments((prev) => [res.data, ...prev]); // prepend locally
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  // Like a comment
  const handleLikeComment = async (commentId) => {
    try {
      const res = await axios.post(
        `http://localhost:5000/api/comments/like/${commentId}`
      );
      socket.emit("like_comment", res.data);
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
    description: movie.overview,
    datePublished: movie.release_date,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: movie.vote_average?.toFixed(1),
      ratingCount: movie.vote_count,
    },
  };

  return (
    <main className="watch-page pulldown2">
      <AdNoticeMarquee />
      <SEOHelmet
        title={`${movie.title} | TobbiHub`}
        description={movie.overview || "Watch the latest movies on TobbiHub"}
        keywords={`watch ${movie.title}, ${movie.title} full movie, TobbiHub movies`}
        image={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
        url={`https://tobbihub.vercel.app/watch/${id}`}
        schema={structuredData}
      />

      {/* Movie Header */}
      <div className="watch-sticky-info">
        <h1>{movie.title}</h1>
        <p className="watch-meta">
          <strong>Release:</strong> {movie.release_date} | <strong>Rating:</strong> {movie.vote_average?.toFixed(1)}
        </p>
      </div>

      {/* Hero Background */}
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

        <iframe
          src={currentSource}
          width="100%"
          height="500"
          frameBorder="0"
          allowFullScreen
          title="Movie Player"
        ></iframe>
      </div>

      {/* Reactions */}
      <div className="reaction-section">
        <button className="reaction-btn" onClick={handleLike}>
          <FiThumbsUp /> {likes}
        </button>
        <button className="reaction-btn" onClick={handleDislike}>
          <FiThumbsDown /> {dislikes}
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
          ></iframe>
        )}
        {showTrailer && !trailerKey && <p className="no-trailer">Trailer not available.</p>}
      </div>

      {/* Comments Section */}
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
          <button type="submit" className="comment-btn">Post</button>
        </form>

        <div className="comment-list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="comment-item">
                <strong>{c.username}</strong>
                <p>{c.comment}</p>
                <button onClick={() => handleLikeComment(c._id)}>
                  ❤️ {c.likes || 0}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
