import { Helmet } from "react-helmet-async";

export default function SEOHelmet({ item, title, description, keywords, image, url }) {
  const dynamicTitle = item
    ? item.title || item.name || "Tobbihub"
    : title || "Tobbihub";

  const dynamicDescription = item
    ? item.overview || "Stream the latest movies and TV shows on Tobbihub."
    : description || "Watch free movies and TV shows on Tobbihub.";

  const dynamicImage = item
    ? `https://image.tmdb.org/t/p/w500${item.poster_path || item.backdrop_path}`
    : image || "/assets/favicon/favicon.ico";

  const dynamicUrl = url || window.location.href;

  const dynamicKeywords =
    keywords || `${dynamicTitle}, ${item ? "movies, tv shows" : "streaming"}, Tobbihub, HD`;

  const defaultTitle = "Tobbihub - Watch Movies & TV Shows Online";

  return (
    <Helmet>
      <title>
        {dynamicTitle !== "Tobbihub" ? `${dynamicTitle} | Tobbihub` : defaultTitle}
      </title>

      <meta name="description" content={dynamicDescription} />
      <meta name="keywords" content={dynamicKeywords} />
      <meta property="og:title" content={dynamicTitle} />
      <meta property="og:description" content={dynamicDescription} />
      <meta property="og:image" content={dynamicImage} />
      <meta property="og:url" content={dynamicUrl} />
      <meta name="twitter:card" content="summary_large_image" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": item ? "Movie" : "WebSite",
          name: dynamicTitle,
          image: dynamicImage,
          description: dynamicDescription,
          url: dynamicUrl,
          aggregateRating: item?.vote_average
            ? {
                "@type": "AggregateRating",
                ratingValue: item.vote_average,
                ratingCount: item.vote_count,
              }
            : undefined,
        })}
      </script>
    </Helmet>
  );
}
