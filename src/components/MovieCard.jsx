import { Link } from "react-router-dom";

export default function MovieCard({ id, title, name, year, image, quality, mediaType }) {
  const displayTitle = title || name || "Untitled";

  const truncateTitle = (text, maxLength = 20) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  // Auto-detect type safely
  const type = mediaType || (title ? "movie" : name ? "tv" : "movie");
  const linkPath = type === "tv" ? `/tv/${id}` : `/watch/${id}`;

  return (
    <Link to={linkPath} className="movie-card">
      <div className="img-card">
        <img src={image} alt={displayTitle} className="card" />
        {quality && <span className="quality-tag">{quality}</span>}
      </div>

      <div className="title-info">
        <h3 className="movie-title" title={displayTitle}>
          {truncateTitle(displayTitle, 20)}
        </h3>
        <p className="movie-info">{year || "Unknown"}</p>
        <button className="movie-btn">Watch</button>
      </div>
    </Link>
  );
}
