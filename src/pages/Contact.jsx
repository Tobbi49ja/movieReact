import React, { useState } from "react";
import SEOHelmet from "../components/seo/SEOHelmet";
import { FaGithub, FaLinkedin, FaTelegramPlane, FaWhatsapp } from "react-icons/fa";
import toast, { Toaster } from "react-hot-toast";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);

  // AUTO SWITCH BASE URL
  const API_BASE =
    import.meta.env.MODE === "development"
      ? "http://localhost:5000/api"
      : "https://moviereact-backend.onrender.com/api";

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValidEmail(form.email)) {
      toast.error("Enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send message");
      } else {
        toast.success("Message sent successfully!");
        setForm({ name: "", email: "", message: "" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Try again later.");
    }

    setLoading(false);
  };

  return (
    <div className="pulldown contact-page">
      <Toaster position="top-right" />

      <SEOHelmet
        title="Contact TobbiHub"
        description="Reach out to TobbiHub with your questions, feedback, or business inquiries."
        name="TobbiHub"
        type="website"
      />

      <section className="page-container">
        <h1>Contact Us</h1>
        <p className="intro-text">
          Got a question, suggestion, or business inquiry? Reach out to us below.
        </p>

        <form className="contact-form upgraded" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Your email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <textarea
            name="message"
            placeholder="Your message"
            rows="5"
            value={form.message}
            onChange={handleChange}
            required
          />

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <div className="loader"></div> : "Send Message"}
          </button>
        </form>

        <div className="social-links">
          <div className="icons">
            <a href="https://github.com/Tobbi49ja" target="_blank" rel="noreferrer" className="social-icon">
              <FaGithub />
            </a>
            <a href={import.meta.env.VITE_LINKEDIN_URL} target="_blank" rel="noreferrer" className="social-icon">
              <FaLinkedin />
            </a>
            <a href="https://t.me/Tobbi456" target="_blank" rel="noreferrer" className="social-icon">
              <FaTelegramPlane />
            </a>
            <a href="https://wa.me/2348120384479" target="_blank" rel="noreferrer" className="social-icon">
              <FaWhatsapp />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
