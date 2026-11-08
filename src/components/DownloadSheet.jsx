import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resolveSources } from "../lib/resolver";

const parseQualityRank = (quality) => {
  const label = typeof quality?.label === "string" ? quality.label : "";
  const match = label.match(/(\d+)p/i);
  if (match) return Number(match[1]);

  const bandwidth = Number(quality?.bandwidth);
  if (Number.isFinite(bandwidth) && bandwidth > 0) return bandwidth;

  return 0;
};

const formatApproxSize = (bandwidth) => {
  if (typeof bandwidth !== "number" || !Number.isFinite(bandwidth) || bandwidth <= 0) {
    return "Approx size unknown";
  }

  const megabytes = Math.max(30, (bandwidth / 1000000) * 18);
  return `Approx ${megabytes.toFixed(0)} MB`;
};

export default function DownloadSheet({
  tmdbId,
  type,
  season,
  episode,
  title,
  onClose,
}) {
  const [status, setStatus] = useState("preparing");
  const [qualities, setQualities] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [selectedSubtitle, setSelectedSubtitle] = useState("none");
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const cancelledRef = useRef(false);

  const normalizedType = String(type || "movie").trim() || "movie";

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      cancelledRef.current = false;
      setStatus("preparing");
      setError("");
      setSelectedQuality("best");
      setSelectedSubtitle("none");

      try {
        const result = await resolveSources({
          tmdbId,
          type: normalizedType,
          season,
          episode,
        });

        if (cancelled || cancelledRef.current) return;

        const nextQualities = Array.isArray(result?.qualities) ? result.qualities : [];
        const nextSubtitles = Array.isArray(result?.subtitles) ? result.subtitles : [];
        const sortedQualities = [...nextQualities].sort((a, b) => parseQualityRank(b) - parseQualityRank(a));

        setQualities(sortedQualities);
        setSubtitles(nextSubtitles);

        if (sortedQualities.length > 0) {
          setSelectedQuality(sortedQualities[0].id || "best");
        }

        setStatus("ready");
      } catch (loadError) {
        if (cancelled || cancelledRef.current) return;
        console.error("Failed to resolve download sources:", loadError);
        setStatus("error");
        setError(loadError?.message || "Something went wrong while preparing download options.");
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [tmdbId, normalizedType, season, episode, retryToken]);

  const subtitleOptions = useMemo(() => {
    const options = [{ id: "none", lang: "none", label: "None" }, ...subtitles];
    return options;
  }, [subtitles]);

  const sortedQualities = useMemo(
    () => [...qualities].sort((a, b) => parseQualityRank(b) - parseQualityRank(a)),
    [qualities]
  );

  const handleAbort = () => {
    cancelledRef.current = true;
    onClose?.();
  };

  const handleDownload = () => {
    onClose?.();
    toast("Downloader coming next");
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(6, 10, 16, 0.6)",
          zIndex: 1000,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Download options"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          margin: "0 auto",
          width: "100%",
          maxWidth: 480,
          background: "#111827",
          color: "#f3f4f6",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -12px 32px rgba(0,0,0,0.35)",
          zIndex: 1001,
          padding: "16px 16px 28px",
          boxSizing: "border-box",
          transform: "translateY(0)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.28)",
            margin: "0 auto 14px",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>Download</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download options"
            style={{
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {status === "preparing" && (
          <div style={{ display: "grid", placeItems: "center", gap: 16, minHeight: 180, padding: "12px 0" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.25)",
                borderTopColor: "#f3f4f6",
                animation: "download-sheet-spin 0.8s linear infinite",
              }}
            />
            <div style={{ color: "#d1d5db", fontSize: 16 }}>Preparing download options...</div>
            <button
              type="button"
              onClick={handleAbort}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "#f3f4f6",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{title || "Download"}</div>

              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>Quality</div>
              <div style={{ display: "grid", gap: 8 }}>
                {sortedQualities.length > 0 ? (
                  sortedQualities.map((quality) => {
                    const qualityKey = quality.id || quality.label || quality.url || "quality";
                    return (
                      <label
                        key={qualityKey}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: selectedQuality === qualityKey ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)",
                          border: selectedQuality === qualityKey ? "1px solid rgba(96,165,250,0.6)" : "1px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="radio"
                            name="download-quality"
                            checked={selectedQuality === qualityKey}
                            onChange={() => setSelectedQuality(qualityKey)}
                            style={{ accentColor: "#60a5fa" }}
                          />
                          <span>{quality.label || quality.id || "Quality"}</span>
                        </span>
                        <span style={{ color: "#cbd5e1", fontSize: 12 }}>
                          {quality.bandwidth ? formatApproxSize(quality.bandwidth) : "Approx size unknown"}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ color: "#d1d5db", opacity: 0.8 }}>No quality options available.</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>Subtitles</div>
              <div style={{ display: "grid", gap: 8 }}>
                {subtitleOptions.map((subtitle) => {
                  const subtitleKey = subtitle.id || subtitle.lang || subtitle.label || "none";
                  return (
                    <label
                      key={subtitleKey}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: selectedSubtitle === subtitleKey ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)",
                        border: selectedSubtitle === subtitleKey ? "1px solid rgba(96,165,250,0.6)" : "1px solid rgba(255,255,255,0.06)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="radio"
                          name="download-subtitle"
                          checked={selectedSubtitle === subtitleKey}
                          onChange={() => setSelectedSubtitle(subtitleKey)}
                          style={{ accentColor: "#60a5fa" }}
                        />
                        <span>{subtitle.label || subtitle.lang || "None"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              Download
            </button>
          </>
        )}

        {status === "error" && (
          <div style={{ display: "grid", gap: 16, minHeight: 150, padding: "12px 0" }}>
            <div style={{ color: "#fca5a5", lineHeight: 1.5 }}>{error || "Unable to prepare download options."}</div>
            <button
              type="button"
              onClick={() => {
                setRetryToken((current) => current + 1);
                setStatus("preparing");
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                background: "#374151",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes download-sheet-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
