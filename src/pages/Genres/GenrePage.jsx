import { useParams, Navigate } from "react-router-dom";
import MoviesFetch from "../../components/MoviesFetch";
import SEOHelmet from "../../components/seo/SEOHelmet";
import { GENRE_MAP } from "../../config/genres";
import { TMDB_API_KEY, TMDB_BASE } from "../../config/api";

const GENRE_DESCRIPTIONS = {
  action: "Explore the best and most thrilling action movies available on TobbiHub. Watch blockbusters, adventures, and adrenaline-pumping titles.",
  animation: "Enjoy animated films full of creativity, laughter, and emotion. Discover classic and new animation movies on TobbiHub.",
  comedy: "Discover the funniest comedy movies to brighten your day. Enjoy hilarious classics and new releases on TobbiHub.",
  drama: "Dive into powerful stories, deep characters, and emotional journeys with the best drama movies on TobbiHub.",
  horror: "Get ready for chills and screams. Explore the scariest horror movies and terrifying thrillers available on TobbiHub.",
  anime: "Explore popular anime movies and TV shows from Japan. Watch trending and classic anime streaming on TobbiHub.",
};

const buildUrl = (genreKey, mediaType) => {
  const genre = GENRE_MAP[genreKey];
  if (genre.language) {
    return `${TMDB_BASE}/discover/${mediaType}?api_key=${TMDB_API_KEY}&language=en-US&with_original_language=${genre.language}&sort_by=popularity.desc`;
  }
  return `${TMDB_BASE}/discover/${mediaType}?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${genre.id}`;
};

export default function GenrePage() {
  const { genre } = useParams();
  const genreConfig = GENRE_MAP[genre];

  // Unknown genre → 404 (hits App's catch-all ErrorPage route)
  if (!genreConfig) return <Navigate to="/404" replace />;

  const title = `${genreConfig.label} | Tobbihub`;
  const description = GENRE_DESCRIPTIONS[genre] || `Watch ${genreConfig.label} streaming on Tobbihub.`;
  const url = `https://moviereact-zzye.onrender.com/genres/${genre}`;

  // Anime combines TV shows + movies
  if (genreConfig.mediaType === "both") {
    return (
      <main className="pulldown">
        <SEOHelmet title={title} description={description} url={url} />

        <h1>{genreConfig.label}</h1>

        <MoviesFetch
          title="Popular Anime TV Shows"
          apiUrl={buildUrl(genre, "tv")}
        />

        <MoviesFetch
          title="Popular Anime Movies"
          apiUrl={buildUrl(genre, "movie")}
        />
      </main>
    );
  }

  return (
    <main className="pulldown">
      <SEOHelmet title={title} description={description} url={url} />

      <h1>{genreConfig.label}</h1>

      <MoviesFetch
        title={genreConfig.label}
        apiUrl={buildUrl(genre, genreConfig.mediaType)}
      />
    </main>
  );
}
