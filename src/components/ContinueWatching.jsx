import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useContinueWatching } from "../hooks/useContinueWatching";
import { FiX } from "react-icons/fi";

export default function ContinueWatching() {
  const { getAll, removeItem } = useContinueWatching();
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getAll());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="continue-watching">
      <h2 className="section-title">Continue Watching</h2>
      <div className="continue-watching-row">
        {items.map((item) => (
          <div key={`${item.id}-${item.mediaType}`} className="continue-card">
            <Link to={item.mediaType === 'tv' ? `/tv/${item.id}` : `/watch/${item.id}`}>
              <div className="continue-img-wrap">
                <img src={item.poster} alt={item.title} loading="lazy" />
                <div className="continue-progress-bar">
                  <div
                    className="continue-progress-fill"
                    style={{ width: `${item.progress || 0}%` }}
                  />
                </div>
                {item.mediaType === 'tv' && item.season && (
                  <span className="continue-ep-badge">
                    S{item.season} E{item.episode}
                  </span>
                )}
              </div>
              <p className="continue-title">{item.title}</p>
            </Link>
            <button
              className="continue-remove-btn"
              onClick={() => {
                removeItem(item.id, item.mediaType);
                setItems(getAll());
              }}
              aria-label="Remove from continue watching"
            >
              <FiX />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
