import MovieCard from "./MovieCard";

export default function MoviesSection({ title, movies }) {
  return (
    <>
      <h1>{title}</h1>
      <section className="movie-section">
        {movies.map((movie, index) => (
          <MovieCard
            key={index}
            title={movie.title}
            year={movie.year}
            image={movie.image}
            quality={movie.quality}
          />
        ))}
      </section>
    </>
  );
}
