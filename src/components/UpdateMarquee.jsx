import { useEffect, useState, useRef } from "react";
import { fetchAppConfig } from "../utils/appConfig";
import { openExternal } from "../utils/openExternal";
import { isNativeApp } from "../utils/platform";

export default function UpdateMarquee() {
  const [cfg, setCfg] = useState(null);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [btn, setBtn] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const c = await fetchAppConfig();
      if (!mounted || !c || !c.latestVersionCode) return;
      if (!c.apkUrl || !c.apkUrl.trim()) return;
      const code = c.latestVersionCode;
      const dismissed = localStorage.getItem(`updateMarqueeDismissed_${code}`);
      if (dismissed === "1") return;

      if (isNativeApp()) {
        try {
          const { App } = await import("@capacitor/app");
          const info = await App.getInfo();
          const installed = Number(info?.build || info?.version || 0);
          if (!(installed < code)) return;
        } catch {
          // if can't read, show
        }
        setText(c.updateNotice || `New version${c.latestVersionName ? ' ' + c.latestVersionName : ''} available`);
        setBtn("Install update");
      } else {
        const ua = navigator.userAgent || "";
        if (!ua.includes("Android")) return;
        setText(c.updateNotice || `New version${c.latestVersionName ? ' ' + c.latestVersionName : ''} available`);
        setBtn("Get the app");
      }
      setCfg(c);
      setVisible(true);
    })();
    return () => { mounted = false; };
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
    localStorage.setItem(`updateMarqueeDismissed_${cfg.latestVersionCode}`, "1");
    setVisible(false);
  };

  const action = () => {
    if (!cfg?.apkUrl) return;
    const url = cfg.apkUrl.startsWith("/") ? window.location.origin + cfg.apkUrl : cfg.apkUrl;
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