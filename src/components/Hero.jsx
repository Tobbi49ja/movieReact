import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/effect-fade";
import { tmdbImg, tmdbImgSrcSetForDataSaver, tmdbImgForDataSaver } from "../utils/tmdb";
import { useDataSaver } from "../utils/dataSaver";

export default function Hero({ type = "movie", accent = "var(--accent)" }) {
  const swaggerRef = useRef(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  const { enabled: dataSaver } = useDataSaver();

  const isMovie = type === "movie";
  const endpoint = isMovie
    ? `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=en-US&page=1`
    : `https://api.themoviedb.org/3/tv/airing_today?api_key=${apiKey}&language=en-US&page=1`;
  const trailerPath = isMovie ? "movie" : "tv";

  useEffect(() => {
    const fetchHeroMovies = async () => {
      try {
        setLoading(true);

        const res = await fetch(endpoint);
        const data = await res.json();
        const topItems = Array.isArray(data?.results)
          ? data.results.slice(0, 5)
          : [];

        const normalized = topItems.map((item) => ({
          ...item,
          title: item.title || item.name,
          release_date: item.release_date || item.first_air_date,
        }));

        const moviesWithTrailers = await Promise.all(
          normalized.map(async (movie) => {
            const trailerRes = await fetch(
              `https://api.themoviedb.org/3/${trailerPath}/${movie.id}/videos?api_key=${apiKey}&language=en-US`
            );
            const trailerData = await trailerRes.json();
            const videos = Array.isArray(trailerData?.results)
              ? trailerData.results
              : [];
            const trailer = videos.find(
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
  }, [apiKey, endpoint, trailerPath]);

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
    <section className="hero-slider" aria-label="Featured movies" style={{ "--hero-accent": accent }}>
      <Swiper
        modules={[Autoplay, Navigation, EffectFade]}
        effect="fade"
        loop={true}
        navigation
        autoplay={dataSaver ? false : { delay: 6000, disableOnInteraction: false }}
        onSwiper={(swiper) => (swaggerRef.current = swagger)}
        className="hero-swiper"
        a11y={{ prevSlideMessage: "Previous movie", nextSlideMessage: "Next movie" }}
      >
        {(Array.isArray(movies) ? movies : []).map((movie, index) => (
          <SwiperSlide key={movie.id}>
            <div className="hero-slide">

              <img
                src={dataSaver ? tmdbImgForDataSaver(movie.backdrop_path, "backdrop", true) : tmdbImgForDataSaver(movie.backdrop_path, "backdrop", false)}
                srcSet={dataSaver ? "" : tmdbImgSrcSetForDataSaver(movie.backdrop_path, "backdrop", false)}
                sizes="100vw"
                alt={`${movie.title} backdrop`}
                className="hero-image"
                loading={index === 0 ? "eager" : (dataSaver ? "lazy" : "lazy")}
                decoding={index === 0 ? "sync" : "async"}
                fetchpriority={index === 0 ? "high" : "low"}
                width="1920"
                height="1080"
              />

          
              <div className="hero-overlay">
                <h2>{movie.title}</h2>
                <p>{movie.overview?.slice(0, 120)}...</p>

                <div className="movie-meta">
                  <span>⭐ {movie.vote_average.toFixed(1)}</span>
                  <span>{movie.release_date?.slice(0, 4)}</span>
                </div>

                <div className="hero-actions">
                  <a
                    href={isMovie ? `/watch/${movie.id}` : `/tv/${movie.id}`}
                    className="movie-btn hero-play"
                    style={{ "--hero-accent": accent, background: accent }}
                    aria-label={`Play ${movie.title}`}
                  >
                    ▶ Play
                  </a>
                  <a
                    href={isMovie ? `/watch/${movie.id}` : `/tv/${movie.id}`}
                    className="movie-btn hero-info"
                    aria-label={`More info about ${movie.title}`}
                  >
                    Info
                  </a>
                </div>

                {movie.trailerKey && (
                  <a
                    href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="movie-btn hero-trailer"
                    style={{ "--hero-accent": accent, background: accent }}
                    aria-label={`Watch ${movie.title} trailer on YouTube`}
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