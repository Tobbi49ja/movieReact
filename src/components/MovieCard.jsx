import { Link } from "react-router-dom";

export default function MovieCard({ id, title, name, year, image, quality, mediaType }) {
  const displayTitle = title || name || "Untitled";

  const truncateTitle = (text, maxLength = 20) =>
    text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  // Detect the type automatically
  const type = mediaType || (title ? "movie" : "tv");

  // Dynamic link and button label
  const linkPath = type === "tv" ? `/tv/${id}` : `/watch/${id}`;
  const buttonLabel = type === "tv" ? "TV Show" : "Movie";

  return (
    <div className="movie-card">
      <div className="img-card">
        <Link to={linkPath}>
          <img src={image} alt={displayTitle} className="card" />
          {quality && <span className="quality-tag">{quality}</span>}
        </Link>
      </div>

      <div className="title-info">
        <h3 className="movie-title" title={displayTitle}>
          {truncateTitle(displayTitle, 20)}
        </h3>
        <p className="movie-info">{year || "Unknown"}</p>

        <Link to={linkPath} className="movie-btn">
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}
