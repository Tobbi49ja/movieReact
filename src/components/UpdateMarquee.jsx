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
    const code = c.latestVersionCode;

    if (isNativeApp()) {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = Number(info?.build || info?.version || 0);
        if (!(installed < code)) return;
      } catch {
        // if can't read, show
      }
    } else {
      const ua = navigator.userAgent || "";
      if (!ua.includes("Android")) return;
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
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .tb-marquee-wrap { overflow: hidden; white-space: nowrap; }
        .tb-marquee-track { display: inline-block; animation: tb-marquee 18s linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .tb-marquee-track { animation: none; transform: none; }
        }
      `}</style>
      <div className="tb-marquee-wrap" style={{ background: "#111", color: "#fff", padding: "6px 0", fontSize: 13 }}>
        <div ref={ref} className="tb-marquee-track">
          <span style={{ marginRight: 16 }}>{text}</span>
          <button onClick={action} style={{ marginRight: 16, cursor: "pointer" }}>{btn}</button>
          <button onClick={dismiss} style={{ cursor: "pointer" }}>×</button>
        </div>
      </div>
    </>
  );
}