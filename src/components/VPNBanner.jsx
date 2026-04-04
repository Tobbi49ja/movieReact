import { useState, useEffect } from "react";

const STORAGE_KEY = "vpnBannerDismissed";

// Replace this URL with your actual NordVPN / Surfshark affiliate link
const AFFILIATE_URL = "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=YOUR_ID";

export default function VPNBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    // Show after 10 seconds — user is engaged, not interrupted immediately
    const timer = setTimeout(() => setVisible(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="vpn-banner" role="complementary" aria-label="Streaming tip">
      <span className="vpn-banner-icon" aria-hidden="true">🔒</span>
      <p className="vpn-banner-text">
        Stream privately &amp; bypass blocks with a VPN
      </p>
      <a
        href={AFFILIATE_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="vpn-banner-cta"
        aria-label="Get NordVPN — affiliate link"
      >
        Get NordVPN
      </a>
      <button
        className="vpn-banner-close"
        onClick={dismiss}
        aria-label="Dismiss VPN suggestion"
      >
        ✕
      </button>
    </div>
  );
}
