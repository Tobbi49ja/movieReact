import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setSubmitting(true);
      await login(email.trim(), password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="auth-page pulldown2">
      <SEOHelmet
        title="Login - Tobbihub"
        description="Log in to your Tobbihub account to save movies, rate titles and more."
      />
      <div className="auth-form">
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password" className="sr-only">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="auth-links">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </main>
  );
}
