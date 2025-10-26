import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import Loader from "../components/Loader";
import {
  FiChevronDown,
  FiChevronUp,
  FiThumbsUp,
  FiThumbsDown,
} from "react-icons/fi";

export default function WatchPage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [currentSource, setCurrentSource] = useState("");
  const [trailerKey, setTrailerKey] = useState(null);

  const trailerRef = useRef(null);
  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // Available streaming sources
  const sources = {
    VidSrc: `https://vidsrc.to/embed/movie/${id}`,
    AutoEmbed: `https://autoembed.cc/embed/movie/${id}`,
    SmashyStream: `https://smashystream.com/embed/movie/${id}`,
    MovieAPI: `https://movieapi.club/embed/movie/${id}`,
  };

  // Fetch movie details and trailer
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const [movieRes, videoRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US`
          ),
          fetch(
            `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=en-US`
          ),
        ]);

        const movieData = await movieRes.json();
        const videoData = await videoRes.json();

        setMovie(movieData);
        setCurrentSource(Object.values(sources)[0]); // default source

        // Find official YouTube trailer
        const trailer = videoData.results?.find(
          (vid) =>
            vid.type === "Trailer" &&
            vid.site === "YouTube" &&
            vid.official === true
        );
        if (trailer) setTrailerKey(trailer.key);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching movie:", err);
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id, TMDB_KEY]);

  const handleTrailerToggle = () => {
    setShowTrailer((prev) => !prev);
    if (!showTrailer && trailerRef.current) {
      trailerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLike = () => setLikes((prev) => prev + 1);
  const handleDislike = () => setDislikes((prev) => prev + 1);

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment.trim()]);
      setNewComment("");
    }
  };

  if (loading) return <Loader />;
  if (!movie) return <p className="loading">Movie not found.</p>;

  return (
    <main className="watch-page pulldown2">
      <div className="watch-sticky-info">
        <h1>{movie.title}</h1>
        <p className="watch-meta">
          <strong>Release:</strong> {movie.release_date} |{" "}
          <strong>Rating:</strong> {movie.vote_average?.toFixed(1)}
        </p>
      </div>

      {/* 🎥 Hero Image */}
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

      {/* 🎬 Streaming Player */}
      <div className="watch-player">
        <h2>Now Playing</h2>

        {/* Source Buttons */}
        <div className="source-buttons">
          {Object.entries(sources).map(([name, url]) => (
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

        {currentSource ? (
          <iframe
            src={currentSource}
            width="100%"
            height="500"
            frameBorder="0"
            allowFullScreen
            title="Movie Player"
          ></iframe>
        ) : (
          <p className="error-msg">Select a streaming source to start watching.</p>
        )}
      </div>

      {/* 👍 Reactions */}
      <div className="reaction-section">
        <button className="reaction-btn" onClick={handleLike}>
          <FiThumbsUp /> {likes}
        </button>
        <button className="reaction-btn" onClick={handleDislike}>
          <FiThumbsDown /> {dislikes}
        </button>
      </div>

      {/* 🎞 Trailer */}
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
            title={`${movie.title} trailer`}
            allowFullScreen
            className="trailer-iframe"
          ></iframe>
        )}
        {showTrailer && !trailerKey && (
          <p className="no-trailer">Trailer not available for this movie.</p>
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
