// src/pages/WatchPage.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Loader from "../components/Loader";
import {
  FiChevronDown,
  FiChevronUp,
  FiThumbsUp,
  FiThumbsDown,
  FiMaximize,
  FiDownload,
} from "react-icons/fi";
import SEOHelmet from "../components/seo/SEOHelmet";

const AppPromptModal = lazy(() => import("../components/AppPromptModal"));
import StarRating from "../components/StarRating";
import { useContinueWatching } from "../hooks/useContinueWatching";
import { useInView } from "../hooks/useInView";
import { cachedAxiosGet, invalidate } from "../utils/cachedAxios";
import { tmdbImgForDataSaver, tmdbImgSrcSetForDataSaver } from "../utils/tmdb";
import { useDataSaver } from "../utils/dataSaver";
import MovieCard from "../components/MovieCard";
import { getSandbox } from "../utils/player";

// -----------------------------
// Dynamic backend URL
// -----------------------------
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "https://moviereact-zzye.onrender.com");

export default function WatchPage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [userReaction, setUserReaction] = useState(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [activeSource, setActiveSource] = useState(0);
  const [deviceType, setDeviceType] = useState("");
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [similarMovies, setSimilarMovies] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const socketRef = useRef(null);
  const trailerRef = useRef(null);
  const trailerIframeRef = useRef(null);
  const iframeRef = useRef(null);
  const playerWrapRef = useRef(null);
  const commentsSectionRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
  const { enabled: dataSaver } = useDataSaver();

  const commentsInView = useInView(commentsSectionRef, { rootMargin: "300px" });

  const handleFullscreen = () => {
    const el = playerWrapRef.current || iframeRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };

  // -----------------------------
  // Detect device type (persisted in localStorage)
  // -----------------------------
  useEffect(() => {
    let storedName = localStorage.getItem("tobbihub_username");
    if (!storedName) {
      const ua = navigator.userAgent.toLowerCase();
      let prefix = "user";
      if (ua.includes("android")) prefix = "android_user";
      else if (ua.includes("iphone")) prefix = "iphone_user";
      else if (ua.includes("samsung")) prefix = "samsung_user";
      storedName = `${prefix}_${Math.floor(Math.random() * 9000 + 1000)}`;
      localStorage.setItem("tobbihub_username", storedName);
    }
    setDeviceType(storedName);
  }, []);

  // -----------------------------
  // Fetch Movie Details + trailer
  // -----------------------------
  useEffect(() => {
    const controller = new AbortController();
    const fetchMovie = async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US&append_to_response=videos,credits`,
          { signal: controller.signal }
        );

        const data = await res.json();
        setMovie(data);

        const videos = Array.isArray(data?.videos?.results) ? data.videos.results : [];
        const trailer = videos.find(
          (vid) => vid.type === "Trailer" && vid.site === "YouTube"
        );
        if (trailer) setTrailerKey(trailer.key);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error fetching movie:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
    return () => controller.abort();
  }, [id, TMDB_KEY]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [id, activeSource]);
  useEffect(() => {
    if (dataSaver) {
      if (!commentsInView || !commentsLoaded) return;
    } else {
      if (!commentsInView) return;
    }
    const controller = new AbortController();
    const fetchComments = async () => {
      try {
        const res = await cachedAxiosGet(
          `${BACKEND_URL}/api/comments/movie/${id}`,
          { signal: controller.signal }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setComments([...list].reverse());
        setCommentsLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error loading comments:", err);
      }
    };
    fetchComments();
    return () => controller.abort();
  }, [id, commentsInView, dataSaver, commentsLoaded]);

  // -----------------------------
  // Socket.io live updates
  // -----------------------------
  useEffect(() => {
    if (dataSaver) {
      if (!commentsInView || !commentsLoaded) return;
    } else {
      if (!commentsInView) return;
    }
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
  }, [id, commentsInView]);

  // Stable device ID — generated once, lives in localStorage forever
  const deviceId = (() => {
    let stored = localStorage.getItem("tobbihub_device_id");
    if (!stored) {
      stored = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("tobbihub_device_id", stored);
    }
    return stored;
  })();

  // Fetch reaction counts + this user's reaction from DB
  useEffect(() => {
    if (!commentsInView) return;
    const controller = new AbortController();
    const fetchReactions = async () => {
      try {
        const res = await cachedAxiosGet(
          `${BACKEND_URL}/api/reactions/movie/${id}?deviceId=${deviceId}`,
          { signal: controller.signal }
        );
        setLikes(res.data.likes);
        setDislikes(res.data.dislikes);
        setUserReaction(res.data.userReaction);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error fetching reactions:", err);
      }
    };
    fetchReactions();
    return () => controller.abort();
  }, [id, commentsInView]);

  const refetchComments = async () => {
    if (!commentsInView) return;
    try {
      const res = await cachedAxiosGet(`${BACKEND_URL}/api/comments/movie/${id}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setComments([...list].reverse());
    } catch (err) {
      if (err.name !== "AbortError") console.error("Error refetching comments:", err);
    }
  };

  const refetchReactions = async () => {
    if (!commentsInView) return;
    try {
      const res = await cachedAxiosGet(
        `${BACKEND_URL}/api/reactions/movie/${id}?deviceId=${deviceId}`
      );
      setLikes(res.data.likes);
      setDislikes(res.data.dislikes);
      setUserReaction(res.data.userReaction);
    } catch (err) {
      if (err.name !== "AbortError") console.error("Error refetching reactions:", err);
    }
  };

  // -----------------------------
  // Handlers
  // -----------------------------
  const handleReaction = async (reaction) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/reactions`, {
        contentId: id,
        contentType: "movie",
        deviceId,
        reaction,
      });
      setLikes(res.data.likes);
      setDislikes(res.data.dislikes);
      setUserReaction(res.data.userReaction);
      invalidate(`${BACKEND_URL}/api/reactions/movie/${id}`);
      refetchReactions();
    } catch (err) {
      console.error("Error saving reaction:", err);
    }
  };

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
      invalidate(`${BACKEND_URL}/api/comments/movie/${id}`);
      refetchComments();
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
      invalidate(`${BACKEND_URL}/api/comments/movie/${id}`);
      refetchComments();
    } catch (err) {
      console.error("Error liking comment:", err);
    }
  };

  useEffect(() => {
    setIframeLoaded(false);
  }, [id, activeSource]);

  const handleTrailerToggle = () => {
    setShowTrailer((prev) => {
      if (prev && trailerIframeRef.current) {
        try { trailerIframeRef.current.src = "about:blank"; } catch { /* cross-origin */ }
      }
      return !prev;
    });
    if (!showTrailer && trailerRef.current) {
      trailerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const SOURCES = [
    { id: "vidrift",  label: "Vidrift",  movieUrl: (id) => `https://embed.vidrift.net/embed/movie/${id, sandbox: false }?title=true&hide=next,episodes,cast`,  tvUrl: (id,s,e) => `https://embed.vidrift.net/embed/tv/${id, sandbox: false }/${s, sandbox: false }/${e, sandbox: false }?title=true&hide=next,episodes,cast` },
    { id: "vidfast",  label: "Vidfast",  movieUrl: (id) => `https://vidfast.vc/movie/${id, sandbox: false }?autoPlay=true&pip=hide`,                           tvUrl: (id,s,e) => `https://vidfast.vc/tv/${id, sandbox: false }/${s, sandbox: false }/${e, sandbox: false }?autoPlay=true&pip=hide` },
    { id: "aether",   label: "Aether",   movieUrl: (id) => `https://aether.ist/media/tmdb-movie-${id, sandbox: false }`,                                       tvUrl: (id,s,e) => `https://aether.ist/media/tmdb-tv-${id, sandbox: false }/${s, sandbox: false }/${e, sandbox: false }` },
    { id: "vidnest",  label: "Vidnest",  movieUrl: (id) => `https://vidnest.fun/movie/${id, sandbox: false }`,                                                 tvUrl: (id,s,e) => `https://vidnest.fun/tv/${id, sandbox: false }/${s, sandbox: false }/${e, sandbox: false }` },
    { id: "vsembed",  label: "VidSrc",   movieUrl: (id) => `https://vsembed.su/embed/movie/${id, sandbox: false }?autoplay=1`,                                 tvUrl: (id,s,e) => `https://vsembed.su/embed/tv/${id, sandbox: false }/${s, sandbox: false }/${e, sandbox: false }?autoplay=1` },
  ];

  const src = SOURCES[activeSource];
  const embedUrl = src.movieUrl(id);

  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      iframe.contentDocument?.head?.insertAdjacentHTML('beforeend', `
        <style>
          .ad, .ads, [class*="ad-"], [class*="popup"], 
          [id*="banner"], .overlay, [class*="overlay"]:not(video),
          iframe[src*="ads"], iframe[src*="doubleclick"] {
            display: none !important;
            visibility: hidden !important;
          }
        </style>
      `);
    } catch { /* Cross-origin iframes will throw — ignore silently */ }
  };

  if (loading) return <Loader />;
  if (!movie) return <p className="loading">Movie not found.</p>;

  return (
    <main id="main-content" className="watch-page pulldown2">
      <SEOHelmet item={movie} url={`https://moviereact-zzye.onrender.com/watch/${id}`} />

      <div className="watch-sticky-info">
        <h1>{movie.title}</h1>
        <p className="watch-meta">
          <strong>Release:</strong> {movie.release_date} |{" "}
          <strong>Rating:</strong> {movie.vote_average?.toFixed(1)}
        </p>
      </div>

      <div className="watch-hero">
        <img
          src={tmdbImg(movie.backdrop_path, "w780", "backdrop")}
          srcSet={`${tmdbImgSrcSet(movie.backdrop_path, ["w780", "w1280"], "backdrop")} , ${tmdbImg(movie.backdrop_path, "original", "backdrop")} 2000w`}
          sizes="(max-width: 767px) 100vw, 100vw"
          alt={movie.title}
          className="watch-bg"
          loading="lazy"
          decoding="async"
        />
        <div className="watch-overlay">
          <p>{movie.overview}</p>
        </div>
      </div>

      {/* Player Section */}
      <div className="watch-player">
        <h2>Now Playing</h2>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px',flexWrap:'wrap'}}>
          {SOURCES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveSource(i)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeSource === i ? '#e50914' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="video-container">
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', maxHeight: '80svh' }} ref={playerWrapRef}>
            {!iframeLoaded ? (
              <button
                onClick={() => setIframeLoaded(true)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: `url(${tmdbImg(movie.backdrop_path, "w780", "backdrop")}) center/cover no-repeat`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Play video"
              >
                <span
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    background: 'rgba(229,9,20,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 0 8px rgba(229,9,20,0.25)'
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            ) : (
              <iframe
                ref={iframeRef}
                key={`${activeSource}-${reloadKey}`}
                src={embedUrl}
                onLoad={handleIframeLoad}
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; fullscreen; picture-in-picture"
                {...(getSandbox(SOURCES[activeSource]) ? { sandbox: getSandbox(SOURCES[activeSource]) } : {})}
              />
            )}
          </div>
        </div>
        <div className="player-actions">
          <button className="fullscreen-btn" onClick={handleFullscreen} aria-label="Fullscreen">
            <FiMaximize /> Fullscreen
          </button>
          <button
            className="download-btn"
            onClick={() => setIsDownloadModalOpen(true)}
            aria-label="Open download options"
          >
            <FiDownload /> Download
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <button className="btn btn-ghost" onClick={() => {
          if (playerWrapRef.current?.requestFullscreen) playerWrapRef.current.requestFullscreen();
        }}>⛶ Fullscreen</button>
        <button className="btn btn-ghost" onClick={() => setReloadKey(k => k + 1)}>⟳ Reload player</button>
      </div>

      {/* Reactions */}
      <div className="reaction-section" aria-label="Movie reactions">
        <button
          className={`reaction-btn ${userReaction === "like" ? "reaction-active" : ""}`}
          onClick={() => handleReaction("like")}
          aria-label="Like this movie"
          aria-pressed={userReaction === "like"}
        >
          <FiThumbsUp aria-hidden="true" />
          <span>{likes} {userReaction === "like" ? "Liked" : "Like"}</span>
        </button>
        <button
          className={`reaction-btn ${userReaction === "dislike" ? "reaction-active" : ""}`}
          onClick={() => handleReaction("dislike")}
          aria-label="Dislike this movie"
          aria-pressed={userReaction === "dislike"}
        >
          <FiThumbsDown aria-hidden="true" />
          <span>{dislikes} {userReaction === "dislike" ? "Disliked" : "Dislike"}</span>
        </button>
      </div>

      {/* Star Rating */}
      <StarRating tmdbId={id} mediaType="movie" />

      {/* Trailer Section */}
      <div className="watch-trailer" ref={trailerRef}>
        <button className="trailer-toggle" onClick={handleTrailerToggle}>
          {showTrailer ? <>Hide Trailer <FiChevronUp /></> : <>Watch Trailer <FiChevronDown /></>}
        </button>
{showTrailer && trailerKey && (
            <div className="trailer-container">
              <iframe
                ref={trailerIframeRef}
                src={`https://www.youtube.com/embed/${trailerKey}`}
                title={`${movie.title} trailer`}
                allow="autoplay; encrypted-media; fullscreen"
                className="trailer-iframe"
                style={{ border: "none" }}
              />
            </div>
          )}
        {showTrailer && !trailerKey && <p className="no-trailer">Trailer not available.</p>}
      </div>

      {/* Comments Section */}
      <section className="comment-section" aria-label="Comments" ref={commentsSectionRef} style={{ minHeight: commentsInView ? "auto" : "200px" }}>
        <h2>Comments</h2>
        {dataSaver && !commentsLoaded ? (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setCommentsLoaded(true);
            }}
            style={{ marginBottom: "1rem" }}
          >
            Load comments
          </button>
        ) : (
          <>
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
          </>
        )}
      </section>

      {/* Similar Movies */}
      <div className="similar-section" ref={commentsSectionRef}>
        {(!dataSaver || commentsInView) && similarMovies.length > 0 && (
          <>
            <h2 className="similar-title">More Like This</h2>
            <div className="similar-grid">
              {similarMovies.map((movieItem) => (
                <MovieCard
                  key={movieItem.id}
                  id={movieItem.id}
                  title={movieItem.title}
                  year={movieItem.release_date?.split("-")[0]}
                  image={tmdbImgForDataSaver(movieItem.poster_path, "poster", dataSaver)}
                  imageSrcSet={tmdbImgSrcSetForDataSaver(movieItem.poster_path, "poster", dataSaver)}
                  mediaType="movie"
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* MovieBox Download Modal */}
      <Suspense fallback={null}>
      <AppPromptModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        itemTitle={movie.title}
      />
      </Suspense>
    </main>
  );
}
