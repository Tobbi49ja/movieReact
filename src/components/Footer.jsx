import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer role="contentinfo">

      <div className="end-info">
        <div className="info-info">
          <div className="logo-container2">
            <Link to="/" aria-label="TobbiHub - Go to homepage">
              <img className="logo2" src="/Logo.png" alt="TobbiHub Logo" />
            </Link>
          </div>
        </div>
        <div className="info-info">
          <p className="copywrite-tobbihub">© TobbiHub {new Date().getFullYear()}</p>
        </div>
      </div>

      <div className="end-info">
        <p className="tobihub-info">
          TobbiHub is a free movies streaming site. We let you watch movies
          and TV series online without registration, featuring over 10,000 titles.
        </p>

        <nav className="social-info" aria-label="Footer navigation">
          <p className="tobihub-info"><Link to="/sitemap">Sitemap</Link></p>
          <p className="tobihub-info"><Link to="/terms">Terms of Service</Link></p>
          <p className="tobihub-info"><Link to="/contact">Contact</Link></p>
        </nav>
      </div>

      <div className="end-info">
        <div className="last-info">
          <div className="last-last-info">
            <p className="tobihub-info">
              TobbiHub does not store any files on our server. We only link to
              media hosted on third-party services.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
