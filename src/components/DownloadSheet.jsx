import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { resolveForProvider, invalidateResolveCache } from "../lib/resolver";
import { cancelResolve } from "../lib/streamResolver";
import { start } from "../lib/downloader";
import { addDownload } from "../lib/downloads";
import { PROVIDER_SOURCES, getProviderById } from "../lib/providerUrls";
import { checkConnection } from "../utils/netCheck";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const parseQualityRank = (quality) => {
  const bandwidth = Number(quality?.avgBandwidth ?? quality?.bandwidth);
  if (Number.isFinite(bandwidth) && bandwidth > 0) return bandwidth;
  return 0;
};

const formatSize = (estBytes) => {
  if (typeof estBytes !== "number" || !Number.isFinite(estBytes) || estBytes <= 0) {
    return "Size unknown";
  }
  const mb = estBytes / (1024 * 1024);
  if (mb < 1024) {
    return `~${Math.round(mb)} MB`;
  }
  return `~${(mb / 1024).toFixed(1)} GB`;
};

export default function DownloadSheet({
  tmdbId,
  type,
  season,
  episode,
  title,
  poster,
  providerId,
  onProviderChange,
  onClose,
}) {
  const [status, setStatus] = useState("preparing");
  const [stage, setStage] = useState("checking");
  const [note, setNote] = useState("");
  const [qualities, setQualities] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState("none");
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [resolverHeaders, setResolverHeaders] = useState({});
  const [currentProvider, setCurrentProvider] = useState(providerId || "");
  const [triedProviders, setTriedProviders] = useState([]);
  const cancelledRef = useRef(false);
  const triedRef = useRef(new Set());
  const controllerRef = useRef(null);
  const lastResultRef = useRef(null);

  const normalizedType = String(type || "movie").trim() || "movie";

  const sheetOpenAtRef = useRef(nowMs());
  const stageLog = (event, data) => {
    console.log(`[dl-stage] ${event} t=+${Math.round(nowMs() - sheetOpenAtRef.current)}ms`, data === undefined ? "" : data);
  };

  useEffect(() => {
    stageLog("sheet open", { provider: providerId || "", type: normalizedType });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    controllerRef.current = controller;

    const loadOptions = async () => {
      cancelledRef.current = false;
      setStatus("preparing");
      stageLog("stage", "checking");
      setStage("checking");
      setNote("");
      setError("");
      setSelectedQuality(null);
      setSelectedSubtitle("none");
      setQualities([]);
      setSubtitles([]);
      setResolverHeaders({});
      lastResultRef.current = null;

      stageLog("checkConnection start");
      let connection;
      try {
        connection = await checkConnection();
      } catch (checkError) {
        stageLog("checkConnection threw", { error: String(checkError?.message || checkError) });
        connection = { ok: false, reason: "unreachable" };
      }
      stageLog("checkConnection result", {
        ok: connection.ok,
        slow: connection.slow,
        reason: connection.reason,
        rtt: connection.rtt,
      });
      if (cancelled || cancelledRef.current || controller.signal.aborted) return;

      if (!connection.ok) {
        setStatus("error");
        setError(
          connection.reason === "offline"
            ? "No internet connection. Connect and try again."
            : "Can't reach the server. Check your connection."
        );
        return;
      }

      stageLog("stage", "finding");
      setStage("finding");

      if (connection.slow) {
        setNote("Weak connection, scanning may take longer");
      }

      const resolveStart = nowMs();
      stageLog("resolveForProvider start", { provider: currentProvider });

      try {
        const result = await resolveForProvider(
          currentProvider,
          { tmdbId, type: normalizedType, season, episode },
          { signal: controller.signal }
        );

        if (cancelled || cancelledRef.current || controller.signal.aborted) return;

        stageLog("resolveForProvider result", {
          status: "ok",
          elapsedMs: Math.round(nowMs() - resolveStart),
          qualities: Array.isArray(result?.qualities) ? result.qualities.length : 0,
        });

        stageLog("stage", "qualities");
        setStage("qualities");
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled || cancelledRef.current || controller.signal.aborted) return;

        const nextQualities = Array.isArray(result?.qualities) ? result.qualities : [];
        const nextSubtitles = Array.isArray(result?.subtitles) ? result.subtitles : [];
        const sortedQualities = [...nextQualities].sort((a, b) => parseQualityRank(b) - parseQualityRank(a));

        lastResultRef.current = result;
        setQualities(sortedQualities);
        setSubtitles(nextSubtitles);
        setResolverHeaders(result?.headers || {});

        if (sortedQualities.length > 0) {
          setSelectedQuality(sortedQualities[0]);
        }

        setStatus("ready");
      } catch (loadError) {
        if (cancelled || cancelledRef.current || controller.signal.aborted || loadError?.message === "Cancelled") return;
        const isTimeout = loadError?.name === "AbortError" || /timeout/i.test(String(loadError?.message || ""));
        stageLog("resolveForProvider result", {
          status: isTimeout ? "timeout" : "error",
          elapsedMs: Math.round(nowMs() - resolveStart),
          error: String(loadError?.message || loadError),
        });
        console.error("Failed to resolve download sources:", loadError);

        triedRef.current.add(currentProvider);
        setTriedProviders(Array.from(triedRef.current));
        const hasRemaining = PROVIDER_SOURCES.some((source) => !triedRef.current.has(source.id));
        setError(loadError?.message || "Something went wrong while preparing download options.");
        setStatus(hasRemaining ? "prompt" : "exhausted");
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
      controller.abort();
      cancelResolve();
    };
  }, [tmdbId, normalizedType, season, episode, currentProvider, retryToken]);

  const subtitleOptions = useMemo(() => {
    const options = [{ id: "none", lang: "none", label: "None" }, ...subtitles];
    return options;
  }, [subtitles]);

  const sortedQualities = useMemo(
    () => [...qualities].sort((a, b) => parseQualityRank(b) - parseQualityRank(a)),
    [qualities]
  );

  const remainingProviders = useMemo(
    () =>
      PROVIDER_SOURCES.filter(
        (source) => source.id !== currentProvider && !triedProviders.includes(source.id)
      ),
    [currentProvider, triedProviders]
  );

  const currentProviderLabel =
    getProviderById(currentProvider)?.label || currentProvider || "This provider";

  const handleAbort = () => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    cancelResolve();
    onClose?.();
  };

  const handleRetry = () => {
    triedRef.current = new Set();
    setTriedProviders([]);
    setRetryToken((current) => current + 1);
  };

  const handlePickProvider = (nextProviderId) => {
    if (!nextProviderId || nextProviderId === currentProvider) return;
    cancelledRef.current = true;
    controllerRef.current?.abort();
    cancelResolve();
    setCurrentProvider(nextProviderId);
    onProviderChange?.(nextProviderId);
  };

  const handleDownload = async () => {
    if (!selectedQuality) return;
    const id = makeId();
    try {
      const headers = resolverHeaders || {};
      const h = (n) => { const k = Object.keys(headers).find((x) => x.toLowerCase() === n); return k ? headers[k] : ""; };
      await start({
        ...selectedQuality,
        referer: h("referer") || h("referrer"),
        userAgent: h("user-agent"),
        cookie: h("cookie"),
        bandwidth: selectedQuality.bandwidth ?? selectedQuality.avgBandwidth ?? 0,
        initUrl: selectedQuality.initUrl || "",
        id,
        tmdbId: tmdbId ?? null,
        season: season ?? null,
        episode: episode ?? null,
        title: title || "Download",
        poster: poster || "",
        label: selectedQuality.label || "",
        estBytes: selectedQuality.estBytes,
        quality: selectedQuality,
        headers,
        providerId: currentProvider,
        embedUrl: lastResultRef.current?.embedUrl || "",
      });
      addDownload({
        id,
        tmdbId: tmdbId ?? null,
        type: normalizedType,
        season: season ?? null,
        episode: episode ?? null,
        title: title || "Download",
        poster: poster || "",
        quality: selectedQuality.label || selectedQuality.quality || "",
        status: "queued",
        progress: 0,
        providerId: currentProvider,
        embedUrl: lastResultRef.current?.embedUrl || "",
      });
      onClose?.();
      toast("Download started");
    } catch (e) {
      const result = lastResultRef.current;
      if (result?.providerId && result?.embedUrl) {
        invalidateResolveCache(result.providerId, result.embedUrl);
      }
      setError(e?.message || "Failed to start download.");
      setStatus("error");
    }
  };

  const showBestAvailable = sortedQualities.length === 1;

  return (
    <>
      <div
        onClick={handleAbort}
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
            onClick={handleAbort}
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
            <div style={{ color: "#d1d5db", fontSize: 16 }}>
              {stage === "checking"
                ? "Checking connection"
                : stage === "finding"
                  ? "Finding stream"
                  : "Reading qualities"}
            </div>
            {note && (
              <div style={{ color: "#fbbf24", fontSize: 13, textAlign: "center" }}>{note}</div>
            )}
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

        {status === "prompt" && (
          <div style={{ display: "grid", gap: 14, minHeight: 150, padding: "12px 0" }}>
            <div style={{ color: "#fca5a5", lineHeight: 1.5 }}>
              {currentProviderLabel} isn't responding or doesn't have this title. Try another provider?
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {remainingProviders.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => handlePickProvider(source.id)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 12,
                    background: "#2563eb",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  Try {source.label}
                </button>
              ))}
            </div>
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

        {status === "exhausted" && (
          <div style={{ display: "grid", gap: 16, minHeight: 150, padding: "12px 0" }}>
            <div style={{ color: "#fca5a5", lineHeight: 1.5 }}>
              No provider has a downloadable stream for this title right now.
            </div>
            <button
              type="button"
              onClick={handleRetry}
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

        {status === "ready" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                {showBestAvailable ? "Best available" : title || "Download"}
              </div>

              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>Quality</div>
              <div style={{ display: "grid", gap: 8 }}>
                {sortedQualities.length > 0 ? (
                  sortedQualities.map((quality) => {
                    const qualityKey = quality.id || quality.url || JSON.stringify(quality);
                    const isLive = quality.live === true;
                    const isEncrypted = quality.encrypted === true;
                    const isSelected = selectedQuality === quality;
                    const container = quality.container || "ts";
                    const codec = quality.codec || "unknown";

                    return (
                      <label
                        key={qualityKey}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 6,
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: isSelected ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
                          border: isSelected ? "1px solid rgba(96,165,250,0.6)" : "1px solid rgba(255,255,255,0.06)",
                          cursor: isLive ? "not-allowed" : "pointer",
                          opacity: isLive ? 0.55 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {quality.label || "Quality"}
                            </span>
                            <span style={{ fontSize: 11, color: "#8892a0", whiteSpace: "nowrap" }}>
                              {quality.resolution ? `${quality.resolution} · ${codec}` : `${codec}`}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: "#cbd5e1", whiteSpace: "nowrap" }}>
                              {formatSize(quality.estBytes)}
                            </span>
                            {isEncrypted && (
                              <span style={{ fontSize: 10, color: "#fbbf24", background: "rgba(251,191,36,0.15)", padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                                Encrypted
                              </span>
                            )}
                            {isLive && (
                              <span style={{ fontSize: 10, color: "#f87171", background: "rgba(248,113,113,0.15)", padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                                Live
                              </span>
                            )}
                            <input
                              type="radio"
                              name="download-quality"
                              checked={isSelected}
                              onChange={() => isLive ? undefined : setSelectedQuality(quality)}
                              disabled={isLive}
                              style={{ accentColor: "#60a5fa", width: 18, height: 18 }}
                            />
                          </div>
                        </div>
                        {isLive && (
                          <span style={{ fontSize: 11, color: "#f87171" }}>
                            Live streams can't be downloaded
                          </span>
                        )}
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
              onClick={handleRetry}
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