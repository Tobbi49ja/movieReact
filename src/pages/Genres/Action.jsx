import MoviesFetch from "../../components/MoviesFetch";
import SEOHelmet from "../../components/seo/SEOHelmet";

export default function Action() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <SEOHelmet
        title="Action Movies | TobbiHub"
        description="Explore the best and most thrilling action movies available on TobbiHub. Watch blockbusters, adventures, and adrenaline-pumping titles."
        url="https://moviereact-zzye.onrender.com/movies/action"
      />

      <h1>Action Movies</h1>

      <MoviesFetch
        title="Action Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=28&page=1`}
      />
    </main>
  );
}
