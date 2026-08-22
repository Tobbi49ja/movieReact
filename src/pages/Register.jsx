import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import SEOHelmet from "../components/seo/SEOHelmet";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSubmitting(true);
      await register(name.trim(), email.trim(), password);
      toast.success("Account created! Welcome to Tobbihub 🎬");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="auth-page pulldown2">
      <SEOHelmet
        title="Register - Tobbihub"
        description="Create a free Tobbihub account to save movies, rate titles and more."
      />
      <div className="auth-form">
        <h1>Register</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="reg-name" className="sr-only">Name</label>
          <input
            id="reg-name"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <label htmlFor="reg-email" className="sr-only">Email</label>
          <input
            id="reg-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="reg-password" className="sr-only">Password</label>
          <input
            id="reg-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="auth-links">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </main>
  );
}
