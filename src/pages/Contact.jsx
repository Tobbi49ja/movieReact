import React, { useState } from "react";
import SEOHelmet from "../components/seo/SEOHelmet";

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
      {/* SEO Meta Tags */}
      <SEOHelmet
        title="Contact TobbiHub"
        description="Reach out to TobbiHub with your questions, feedback, or business inquiries. We're here to help with anything related to movies, TV shows, and animations."
        name="TobbiHub"
        type="website"
      />

      {/* Page Content */}
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
      </section>
    </div>
  );
}
