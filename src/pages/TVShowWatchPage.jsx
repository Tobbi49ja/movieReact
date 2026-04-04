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
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userReaction, setUserReaction] = useState(null);
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
  // Sources — VidSrc default (most content)
  // -----------------------------
  const sources = (season, episode) => ({
    VidSrc:  `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
    VidSrc2: `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
    TwoEmbed:`https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
    VidSrc3: `https://vidsrc.pro/embed/tv/${id}?season=${season}&episode=${episode}`,
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
  // Stable device ID
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
    const fetchReactions = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/reactions/tv/${id}?deviceId=${deviceId}`
        );
        setLikes(res.data.likes);
        setDislikes(res.data.dislikes);
        setUserReaction(res.data.userReaction);
      } catch (err) {
        console.error("Error fetching reactions:", err);
      }
    };
    fetchReactions();
  }, [id]);

  const handleReaction = async (reaction) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/reactions`, {
        contentId: id,
        contentType: "tv",
        deviceId,
        reaction,
      });
      setLikes(res.data.likes);
      setDislikes(res.data.dislikes);
      setUserReaction(res.data.userReaction);
    } catch (err) {
      console.error("Error saving reaction:", err);
    }
  };

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

  const handleEpisodeSelect = (ep) => {
    setSelectedEpisode(ep);
    setCurrentSource(Object.values(sources(selectedSeason, ep.episode_number))[0]);
    setShowEpisodePanel(false); // collapse after picking
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <main id="main-content" className="watch-page pulldown2">
      <SEOHelmet item={show} url={`https://moviereact-zzye.onrender.com/tv/${id}`} />
      <AdNoticeMarquee />

      {/* Title */}
      <div className="watch-sticky-info">
        <h1 className="watch-title">{show.name}</h1>
        <p className="watch-meta">
          <strong>First Air Date:</strong> {show.first_air_date} |{" "}
          <strong>Rating:</strong> {show.vote_average?.toFixed(1)}
        </p>
      </div>

      {/* Hero */}
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

      {/* Player — shown first so users can watch immediately */}
      <div className="watch-player">
        <h2>
          Now Playing
          {selectedEpisode && (
            <span className="now-playing-ep">
              {" "}— S{selectedSeason} E{selectedEpisode.episode_number}: {selectedEpisode.name}
            </span>
          )}
        </h2>

        <div className="source-buttons">
          {selectedEpisode &&
            Object.entries(sources(selectedSeason, selectedEpisode.episode_number)).map(
              ([name, url]) => (
                <button
                  key={name}
                  className={`source-btn ${currentSource === url ? "active-source" : ""}`}
                  onClick={() => setCurrentSource(url)}
                >
                  {name}
                </button>
              )
            )}
        </div>

        <div className="video-container">
          {currentSource ? (
            <iframe
              key={currentSource}
              src={currentSource}
              title={selectedEpisode ? `S${selectedSeason} E${selectedEpisode.episode_number} - ${selectedEpisode.name}` : "TV Player"}
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              style={{ border: "none" }}
            />
          ) : (
            <div className="player-placeholder">
              <p>Select an episode below to start watching</p>
            </div>
          )}
        </div>
      </div>

      {/* Season + Episode Selector — collapsible panel below the player */}
      <div className="episode-panel">
        {/* Season dropdown row */}
        <div className="episode-panel-header">
          <div className="season-selector">
            <label htmlFor="season-select">Season:</label>
            <select
              id="season-select"
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(Number(e.target.value));
                setShowEpisodePanel(true);
              }}
              aria-label="Select TV show season"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.season_number}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="episode-toggle-btn"
            onClick={() => setShowEpisodePanel((prev) => !prev)}
            aria-expanded={showEpisodePanel}
            aria-controls="episode-list"
          >
            {showEpisodePanel ? (
              <>Episodes <FiChevronUp /></>
            ) : (
              <>Episodes ({episodes.length}) <FiChevronDown /></>
            )}
          </button>
        </div>

        {/* Collapsible episode list */}
        {showEpisodePanel && (
          <ul className="episode-list" id="episode-list" role="listbox" aria-label="Episodes">
            {episodes.map((ep) => (
              <li
                key={ep.id}
                role="option"
                aria-selected={selectedEpisode?.id === ep.id}
                className={`episode-row ${selectedEpisode?.id === ep.id ? "active" : ""}`}
                onClick={() => handleEpisodeSelect(ep)}
              >
                <span className="ep-number">E{ep.episode_number}</span>
                <span className="ep-name">{ep.name}</span>
                {ep.runtime && <span className="ep-runtime">{ep.runtime}m</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <VPNBanner />

      {/* Reactions */}
      <div className="reaction-section" aria-label="Show reactions">
        <button
          className={`reaction-btn ${userReaction === "like" ? "reaction-active" : ""}`}
          onClick={() => handleReaction("like")}
          aria-label="Like this show"
          aria-pressed={userReaction === "like"}
        >
          <FiThumbsUp aria-hidden="true" />
          <span>{likes} {userReaction === "like" ? "Liked" : "Like"}</span>
        </button>
        <button
          className={`reaction-btn ${userReaction === "dislike" ? "reaction-active" : ""}`}
          onClick={() => handleReaction("dislike")}
          aria-label="Dislike this show"
          aria-pressed={userReaction === "dislike"}
        >
          <FiThumbsDown aria-hidden="true" />
          <span>{dislikes} {userReaction === "dislike" ? "Disliked" : "Dislike"}</span>
        </button>
      </div>

      {/* Trailer */}
      <div className="watch-trailer" ref={trailerRef}>
        <button className="trailer-toggle" onClick={handleTrailerToggle}>
          {showTrailer ? <>Hide Trailer <FiChevronUp /></> : <>Watch Trailer <FiChevronDown /></>}
        </button>
        {showTrailer && trailerKey && (
          <iframe
            className="trailer-iframe"
            src={`https://www.youtube.com/embed/${trailerKey}`}
            title={`${show.name} Trailer`}
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
            style={{ border: "none" }}
          />
        )}
        {showTrailer && !trailerKey && <p className="no-trailer">Trailer not available.</p>}
      </div>

      {/* Comments */}
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
