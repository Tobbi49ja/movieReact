import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      {/* Top Section - Logo & Copyright */}
      <div className="end-info">
        <div className="info-info">
          <div className="logo-container2">
            <Link to="/">
              <img className="logo2" src="/Logo.png" alt="Tobbihub Logo" />
            </Link>
          </div>
        </div>
        <div className="info-info">
          <p className="copywrite-tobbihub">© Tobbihub</p>
        </div>
      </div>

      {/* Middle Section - Description + Links */}
      <div className="end-info">
        <p className="tobihub-info">
          Tobihub is a free movies streaming site with zero ads. We let you watch movies
          and TV-Series online without registration, featuring over 10,000 titles.
        </p>

        <div className="social-info">
          <p className="tobihub-info"><Link to="/sitemap">Sitemap</Link></p>
          <p className="tobihub-info"><Link to="/terms">Terms of Service</Link></p>
          <p className="tobihub-info"><Link to="/contact">Contact</Link></p>
        </div>
      </div>

      {/* Bottom Section - Disclaimer */}
      <div className="end-info">
        <div className="last-info">
          <div className="last-last-info">
            <p className="tobihub-info">
              Tobbihub does not store any files on our server. We only link to
              media hosted on third-party services.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
