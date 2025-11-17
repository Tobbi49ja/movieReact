import React, { useState } from "react";
import SEOHelmet from "../components/seo/SEOHelmet";
import {
  FaGithub,
  FaLinkedin,
  FaTelegramPlane,
  FaWhatsapp,
} from "react-icons/fa";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Message sent successfully!");
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <div className="pulldown contact-page">
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

        <form className="contact-form" onSubmit={handleSubmit}>
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

          <button type="submit" className="submit-btn">
            Send Message
          </button>
        </form>

        {/* SOCIALS SECTION */}
        <div className="social-links">
          <div className="icons">
            <a
              href="https://github.com/Tobbi49ja"
              target="_blank"
              rel="noreferrer"
              className="social-icon"
            >
              <FaGithub />
            </a>

            <a
              href={import.meta.env.VITE_LINKEDIN_URL}
              target="_blank"
              rel="noreferrer"
              className="social-icon"
            >
              <FaLinkedin />
            </a>

            <a
              href="https://t.me/Tobbi456"
              target="_blank"
              rel="noreferrer"
              className="social-icon"
            >
              <FaTelegramPlane />
            </a>

            <a
              href="https://wa.me/2348120384479"
              target="_blank"
              rel="noreferrer"
              className="social-icon"
            >
              <FaWhatsapp />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
