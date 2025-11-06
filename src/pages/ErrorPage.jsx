import { Link } from "react-router-dom";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function ErrorPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "black",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "20px",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      {/* 🧠 SEO */}
      <SEOHelmet
        title="404 - Page Not Found | TobbiHub"
        description="The page you’re looking for could not be found on TobbiHub. It may have been moved or deleted."
        url="https://tobbihub.com/404"
        noIndex={true}
      />

      {/* Logo */}
      <img
        src="/assets/logo/logo-removebg-preview.png"
        alt="TobbiHub Logo"
        style={{ width: "120px", marginBottom: "20px" }}
      />

      {/* Error Text */}
      <h1 style={{ fontFamily: "New Rocker", color: "red", fontSize: "4rem" }}>
        404
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "25px" }}>
        Oops! The page you’re looking for doesn’t exist or was moved.
      </p>

      {/* Button */}
      <Link
        to="/"
        style={{
          backgroundColor: "red",
          color: "white",
          padding: "10px 20px",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: "600",
          textTransform: "capitalize",
        }}
      >
        Go back home
      </Link>
    </div>
  );
}
