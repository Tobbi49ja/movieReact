import { Link } from "react-router-dom";

export default function MovieCard({ id, title, year, image, quality }) {
  const truncateTitle = (text, maxLength = 20) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <Link to={`/watch/${id}`} className="movie-card">
      <div className="img-card">
        <img src={image} alt={title} className="card" />
        {quality && <span className="quality-tag">{quality}</span>}
      </div>

      <div className="title-info">
        <h3 className="movie-title" title={title}>
          {truncateTitle(title, 20)}
        </h3>
        <p className="movie-info">{year}</p>
        <button className="movie-btn">movie</button>
      </div>
    </Link>
  );
}
