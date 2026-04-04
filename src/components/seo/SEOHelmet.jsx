import { Helmet } from "react-helmet-async";

const SITE_URL = "https://moviereact-zzye.onrender.com";

export default function SEOHelmet({ item, title, description, keywords, image, url }) {
  const dynamicTitle = item
    ? item.title || item.name || "Tobbihub"
    : title || "Tobbihub";

  const dynamicDescription = item
    ? item.overview || "Stream the latest movies and TV shows on Tobbihub."
    : description || "Watch free movies and TV shows on Tobbihub.";

  const dynamicImage = item
    ? `https://image.tmdb.org/t/p/w500${item.poster_path || item.backdrop_path}`
    : image || `${SITE_URL}/Logo.png`;

  const dynamicUrl = url || (typeof window !== "undefined" ? window.location.href : SITE_URL);
  const canonicalUrl = url || SITE_URL;

  const dynamicKeywords =
    keywords || `${dynamicTitle}, ${item ? "movies, tv shows" : "streaming"}, Tobbihub, HD`;

  const defaultTitle = "Tobbihub - Watch Movies & TV Shows Online";
  const pageTitle = dynamicTitle !== "Tobbihub" ? `${dynamicTitle} | Tobbihub` : defaultTitle;

  const schemaType = item
    ? item.first_air_date !== undefined ? "TVSeries" : "Movie"
    : "WebSite";

  return (
    <Helmet>
      <title>{pageTitle}</title>

      <meta name="description" content={dynamicDescription} />
      <meta name="keywords" content={dynamicKeywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={item ? "video.movie" : "website"} />
      <meta property="og:site_name" content="TobbiHub" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={dynamicDescription} />
      <meta property="og:image" content={dynamicImage} />
      <meta property="og:url" content={dynamicUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={dynamicDescription} />
      <meta name="twitter:image" content={dynamicImage} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": schemaType,
          name: dynamicTitle,
          image: dynamicImage,
          description: dynamicDescription,
          url: dynamicUrl,
          ...(item?.vote_average && {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: item.vote_average,
              ratingCount: item.vote_count,
            },
          }),
          ...(item?.release_date && { datePublished: item.release_date }),
          ...(item?.first_air_date && { datePublished: item.first_air_date }),
        })}
      </script>
    </Helmet>
  );
}
