import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/effect-fade";

export default function Hero() {
  const swiperRef = useRef(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;

  useEffect(() => {
    const fetchHeroMovies = async () => {
      try {
        setLoading(true);

      
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=en-US&page=1`
        );
        const data = await res.json();
        const topMovies = data.results.slice(0, 5);


        const moviesWithTrailers = await Promise.all(
          topMovies.map(async (movie) => {
            const trailerRes = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${apiKey}&language=en-US`
            );
            const trailerData = await trailerRes.json();
            const trailer = trailerData.results.find(
              (vid) => vid.type === "Trailer" && vid.site === "YouTube"
            );
            return { ...movie, trailerKey: trailer ? trailer.key : null };
          })
        );

        setMovies(moviesWithTrailers);
      } catch (err) {
        console.error("Error fetching hero movies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHeroMovies();
  }, [apiKey]);

  if (loading) {
    return (
      <section className="hero-slider">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading movies...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-slider">
      <Swiper
        modules={[Autoplay, Navigation, EffectFade]}
        effect="fade"
        loop={true}
        navigation
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        className="hero-swiper"
      >
        {movies.map((movie) => (
          <SwiperSlide key={movie.id}>
            <div className="hero-slide">
            
              <img
                src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
                alt={movie.title}
                className="hero-image"
              />

          
              <div className="hero-overlay">
                <h2>{movie.title}</h2>
                <p>{movie.overview?.slice(0, 120)}...</p>

                <div className="movie-meta">
                  <span>⭐ {movie.vote_average.toFixed(1)}</span>
                  <span>{movie.release_date?.slice(0, 4)}</span>
                </div>

                {movie.trailerKey && (
                  <a
                    href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="movie-btn"
                  >
                    ▶ Watch Trailer
                  </a>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
