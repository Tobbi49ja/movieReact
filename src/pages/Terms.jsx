import React from "react";

export default function TermsOfService() {
  return (
    <div className="pulldown terms-page">
      <section className="page-container">
        <h1>Terms of Service</h1>
        <p className="intro-text">
          Please read these terms carefully before using our website or services.
          By accessing TobbiHub, you agree to these terms and conditions.
        </p>

        <div className="terms-section">
          <h2>1. Content Ownership</h2>
          <p>
            TobbiHub does not host any media files on its servers. All videos and
            images are provided through third-party APIs. We respect all copyright
            laws and do not claim ownership of the content displayed.
          </p>

          <h2>2. User Responsibilities</h2>
          <p>
            You agree to use TobbiHub solely for personal and non-commercial
            entertainment purposes. Redistribution, re-uploading, or downloading
            content from third-party sources may violate copyright laws.
          </p>

          <h2>3. Service Availability</h2>
          <p>
            While we aim to provide smooth streaming, TobbiHub cannot guarantee
            uninterrupted service. External sources may experience downtime,
            removals, or regional restrictions.
          </p>

          <h2>4. External Links</h2>
          <p>
            Our platform may contain links to third-party sites. TobbiHub is not
            responsible for their privacy policies, content accuracy, or reliability.
          </p>

          <h2>5. Updates to Terms</h2>
          <p>
            We may modify these terms at any time. Continued use of TobbiHub
            signifies your acceptance of the updated Terms of Service.
          </p>
        </div>
      </section>
    </div>
  );
}
