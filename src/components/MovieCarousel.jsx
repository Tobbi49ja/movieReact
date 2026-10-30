import { useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { tmdbImgForDataSaver, tmdbImgSrcSetForDataSaver } from "../utils/tmdb";
import { useDataSaver } from "../utils/dataSaver";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies = [], source }) {
  const rowRef = useRef(null);
  const { enabled: dataSaver } = useDataSaver();

  const scroll = (dir) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  if (!movies.length) return null;

  const displayMovies = dataSaver ? movies.slice(0, 12) : movies;

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
        {displayMovies.map(m => (
          <div className="carousel-item" key={m.id}>
            <MovieCard
              id={m.id}
              title={m.title || m.name}
              year={m.release_date?.split('-')[0] || m.first_air_date?.split('-')[0]}
              image={tmdbImgForDataSaver(m.poster_path, "poster", dataSaver)}
              imageSrcSet={tmdbImgSrcSetForDataSaver(m.poster_path, "poster", dataSaver)}
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