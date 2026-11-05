import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { openExternal } from "../utils/openExternal";
import { isNativeApp } from "../utils/platform";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3001"
    : "https://moviereact-zzye.onrender.com");

let dismissedThisSession = false;

export default function UpdateMarquee() {
  const [cfg, setCfg] = useState(null);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [btn, setBtn] = useState("");
  const ref = useRef(null);

  const loadConfig = async () => {
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/app-config?t=${Date.now()}`
      );
      return res.data?.data || null;
    } catch {
      return null;
    }
  };

  const evaluate = async () => {
    if (dismissedThisSession) return;
    const c = await loadConfig();
    if (!c || !c.latestVersionCode) return;
    if (!c.apkUrl || !c.apkUrl.trim()) return;

    const code = Number(c.latestVersionCode);
    if (!Number.isFinite(code) || code < 1) return;

    let installed = 0;
    if (isNativeApp()) {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const raw = String(info?.build || info?.version || "").trim();
        const parsed = Number(raw.split(/[^0-9]+/).filter(Boolean).join(""));
        installed = Number.isFinite(parsed) ? parsed : 0;
      } catch {
        installed = 0;
      }
    } else {
      const ua = navigator.userAgent || "";
      if (!ua.includes("Android")) return;
    }

    if (installed >= code) {
      setVisible(false);
      return;
    }

    setText(
      c.updateNotice ||
        `New version${c.latestVersionName ? ' ' + c.latestVersionName : ''} available`
    );
    setBtn(isNativeApp() ? "Install update" : "Get the app");
    setCfg(c);
    setVisible(true);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await evaluate();
    };
    run();

    let foreListener = null;
    if (isNativeApp()) {
      (async () => {
        try {
          const { App } = await import("@capacitor/app");
          foreListener = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) run();
          });
        } catch {
          // ignore
        }
      })();
    }

    return () => {
      mounted = false;
      if (foreListener) {
        try { foreListener.remove(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        el.style.animationPlayState = e.isIntersecting ? "running" : "paused";
      });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  if (!visible || !cfg) return null;

  const dismiss = () => {
    dismissedThisSession = true;
    setVisible(false);
  };

  const action = () => {
    if (!cfg?.apkUrl) return;
    const url = cfg.apkUrl.startsWith("/")
      ? window.location.origin + cfg.apkUrl
      : cfg.apkUrl;
    if (isNativeApp()) openExternal(url);
    else window.location.href = url;
  };

  return (
    <>
      <style>{`
        @keyframes tb-marquee {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-50%,0,0); }
        }
        .tb-marquee-wrap {
          overflow: hidden;
          white-space: nowrap;
          background: #111;
          color: #fff;
          padding: 6px 0;
          font-size: 13px;
          width: 100%;
        }
        .tb-marquee-track {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          min-width: max-content;
          animation: tb-marquee 18s linear infinite;
          will-change: transform;
          padding-right: 16px;
        }
        .tb-marquee-track > * { flex-shrink: 0; }
        @media (prefers-reduced-motion: reduce) {
          .tb-marquee-track { animation: none; transform: none; }
        }
      `}</style>
      <div className="tb-marquee-wrap">
        <div ref={ref} className="tb-marquee-track">
          {[0, 1].map((repeat) => (
            <div key={repeat} style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
              <span>{text}</span>
              <button onClick={action} style={{ cursor: "pointer" }}>{btn}</button>
              <button onClick={dismiss} style={{ cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}