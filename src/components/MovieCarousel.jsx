import { useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies = [], source }) {
  const rowRef = useRef(null);

  const scroll = (dir) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  if (!movies.length) return null;

  return (
    <section className="carousel-section">
      <div className="carousel-header">
        <h2 className="section-title">{title}</h2>
        <div className="carousel-controls">
          <button onClick={() => scroll('left')} aria-label="Scroll left">
            <FiChevronLeft />
          </button>
          <button onClick={() => scroll('right')} aria-label="Scroll right">
            <FiChevronRight />
          </button>
        </div>
      </div>
      <div className="carousel-row" ref={rowRef}>
        {movies.map(m => (
          <div className="carousel-item" key={m.id}>
            <MovieCard
              id={m.id}
              title={m.title || m.name}
              year={m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0]}
              image={`https://image.tmdb.org/t/p/w300${m.poster_path}`}
              mediaType={m.media_type || (m.title ? 'movie' : 'tv')}
              releaseDate={m.release_date || m.first_air_date}
              source={source}
              showBookmark={true}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
