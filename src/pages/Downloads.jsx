import { FiDownload, FiInbox, FiPause, FiPlay, FiTrash2 } from "react-icons/fi";
import SEOHelmet from "../components/seo/SEOHelmet";
import useDownloads from "../hooks/useDownloads";
import { pauseDownload, resumeDownload } from "../lib/downloadEngine";
import { removeDownload } from "../lib/downloads";

function formatStatus(status) {
  return String(status || "queued").replace(/(^\w)|\s+(\w)/g, (match) => match.toUpperCase());
}

export default function DownloadsPage() {
  const downloads = useDownloads();

  const handleTogglePause = (download) => {
    const shouldPause = ["queued", "downloading"].includes(download.status);
    if (shouldPause) {
      pauseDownload(download.id);
    } else {
      resumeDownload(download.id);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-slate-950 px-4 pb-24 pt-5 text-white sm:px-6">
      <SEOHelmet
        title="Downloads - Tobbihub"
        description="Manage your queued and completed downloads on Tobbihub."
      />

      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/80">Library</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Downloads</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
            <FiDownload className="text-cyan-300" />
            {downloads.length} item{downloads.length === 1 ? "" : "s"}
          </div>
        </div>

        {downloads.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
            <div className="mb-4 rounded-full border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <FiInbox className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-white">No downloads yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              Start a download from a movie or show, and it will show up here with progress and status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {downloads.map((download) => {
              const progress = Math.min(Math.max(Number(download.progress) || 0, 0), 100);
              const canPause = ["queued", "downloading"].includes(download.status);

              return (
                <article
                  key={download.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-lg shadow-slate-950/20 sm:flex-row sm:items-center"
                >
                  <div className="h-24 w-16 overflow-hidden rounded-xl border border-white/10 bg-slate-800/80 sm:h-28 sm:w-20">
                    {download.poster ? (
                      <img src={download.poster} alt={download.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-slate-300">
                        {download.title?.slice(0, 2).toUpperCase() || "DL"}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">{download.title || "Untitled download"}</h3>
                        <p className="text-xs text-slate-300">
                          {download.quality || "1080p"}
                          {download.type ? ` • ${download.type}` : ""}
                          {download.season ? ` • S${download.season}` : ""}
                          {download.episode ? `E${download.episode}` : ""}
                        </p>
                      </div>

                      <div className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-200">
                        {formatStatus(download.status)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
                    <button
                      type="button"
                      onClick={() => handleTogglePause(download)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      {canPause ? <FiPause className="h-4 w-4" /> : <FiPlay className="h-4 w-4" />}
                      {canPause ? "Pause" : "Resume"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeDownload(download.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
