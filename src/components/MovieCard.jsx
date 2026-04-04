import { Link } from "react-router-dom";

export default function MovieCard({
  id,
  title,
  name,
  year,
  image,
  quality,
  mediaType,
}) {
  const displayTitle = title || name || "Untitled";

  const truncateTitle = (text, maxLength = 20) =>
    text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  // Detect the type automatically
  const type = mediaType || (title ? "movie" : "tv");

  // Dynamic link and button label
  const linkPath = type === "tv" ? `/tv/${id}` : `/watch/${id}`;
  const buttonLabel = type === "tv" ? "TV Show" : "Movie";

  return (
    <article className="movie-card">
      <div className="img-card">
        <Link to={linkPath} aria-label={`View ${displayTitle}`} tabIndex={-1} aria-hidden="true">
          <img src={image} alt={displayTitle} loading="lazy" className="card" width="195" height="293" />
          {quality && <span className="quality-tag">{quality}</span>}
        </Link>
      </div>

      <div className="title-info">
        <h3 className="movie-title" title={displayTitle}>
          {truncateTitle(displayTitle, 20)}
        </h3>
        <p className="movie-info">{year || "Unknown"}</p>

        <Link to={linkPath} className="movie-btn" aria-label={`Watch ${displayTitle} (${buttonLabel})`}>
          {buttonLabel}
        </Link>
      </div>
    </article>
  );
}
