import MoviesFetch from "../../components/MoviesFetch";
import SEOHelmet from "../../components/seo/SEOHelmet";

export default function Horror() {
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  return (
    <main className="pulldown">
      <SEOHelmet
        title="Horror Movies | TobbiHub"
        description="Get ready for chills and screams. Explore the scariest horror movies and terrifying thrillers available on TobbiHub."
        url="https://moviereact-zzye.onrender.com/genres/horror"
      />

      <h1>Horror</h1>

      <MoviesFetch
        title="Horror Movies"
        apiUrl={`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=27&page=1`}
      />
    </main>
  );
}
