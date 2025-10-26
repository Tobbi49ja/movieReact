import { Link } from "react-router-dom";

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
      <img
        src="/assets/logo/logo-removebg-preview.png"
        alt="Logo"
        style={{ width: "120px", marginBottom: "20px" }}
      />
      <h1 style={{ fontFamily: "New Rocker", color: "red", fontSize: "4rem" }}>
        404
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "25px" }}>
        Oops! The page you’re looking for doesn’t exist or was moved.
      </p>
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
