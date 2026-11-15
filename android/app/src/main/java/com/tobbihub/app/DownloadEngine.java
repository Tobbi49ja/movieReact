package com.tobbihub.app;

import android.content.Context;
import android.os.Environment;
import android.os.StatFs;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class DownloadEngine {
    private static final String TAG = "DownloadEngine";
    private static final int MAX_RETRIES = 3;
    private static final int[] RETRY_DELAYS_MS = {1000, 2000, 4000};
    private static final int WORKER_THREADS = 4;
    private static final int SAVE_INTERVAL_MS = 5000;
    private static final int PROGRESS_INTERVAL_MS = 1000;
    private static final int CONSECUTIVE_AUTH_ERRORS_LIMIT = 3;

    public interface Listener {
        void onStarted(String id);
        void onProgress(JSONObject p);
        void onPaused(String id);
        void onComplete(String id, String path, long size);
        void onError(String id, String code, String msg);
    }

    private final Context context;
    private final Listener listener;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService timerExecutor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, DownloadTask> activeTasks = Collections.synchronizedMap(new HashMap<>());

    public DownloadEngine(Context ctx, Listener l) {
        this.context = ctx.getApplicationContext();
        this.listener = l;
    }

    public void start(JSONObject req) {
        String id = req.optString("id");
        if (id.isEmpty()) {
            notifyError(id, "INVALID", "Missing id");
            return;
        }

        if (activeTasks.containsKey(id)) {
            notifyError(id, "INVALID", "Download already in progress");
            return;
        }

        executor.execute(() -> runDownload(id, req));
    }

    public void pause(String id) {
        DownloadTask task = activeTasks.get(id);
        if (task != null) {
            task.pause();
        }
    }

    public void cancel(String id) {
        DownloadTask task = activeTasks.remove(id);
        if (task != null) {
            task.cancel();
            deleteFolder(task.folder);
        }
    }

    public void resume(String id, JSONObject newReq) {
        DownloadTask task = activeTasks.get(id);
        if (task != null) {
            task.resume(newReq);
        } else {
            start(newReq != null ? newReq : createResumeReq(id));
        }
    }

    private JSONObject createResumeReq(String id) {
        File folder = getDownloadFolder(id);
        DownloadManifest manifest = DownloadManifest.load(folder);
        if (manifest != null) {
            JSONObject req = new JSONObject();
            try {
                req.put("id", id);
                req.put("url", manifest.path);
                req.put("title", manifest.title);
                req.put("poster", manifest.poster);
                req.put("label", manifest.label);
                req.put("container", manifest.container);
                req.put("hasAudio", manifest.hasAudio);
                req.put("estBytes", manifest.estBytes);
            } catch (JSONException ignored) {}
            return req;
        }
        return new JSONObject();
    }

    public JSONArray list() {
        File baseDir = getBaseDownloadsDir();
        JSONArray array = new JSONArray();
        if (baseDir != null && baseDir.exists()) {
            File[] folders = baseDir.listFiles(File::isDirectory);
            if (folders != null) {
                for (File folder : folders) {
                    DownloadManifest manifest = DownloadManifest.load(folder);
                    if (manifest != null) {
                        JSONObject json = manifest.toJson();
                        if ("downloading".equals(manifest.status)) {
                            try {
                                json.put("status", "paused");
                            } catch (JSONException ignored) {}
                        }
                        array.put(json);
                    }
                }
            }
        }
        return array;
    }

    private File getBaseDownloadsDir() {
        File external = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        File base = external != null ? new File(external, "downloads") : new File(context.getFilesDir(), "downloads");
        if (!base.exists()) {
            base.mkdirs();
        }
        return base;
    }

    private File getDownloadFolder(String id) {
        return new File(getBaseDownloadsDir(), id);
    }

    private void runDownload(String id, JSONObject req) {
        File folder = getDownloadFolder(id);
        if (!folder.exists()) {
            folder.mkdirs();
        }

        DownloadManifest manifest = DownloadManifest.load(folder);
        boolean isResume = manifest != null && manifest.status != null && !manifest.status.equals("queued");

        if (!isResume) {
            manifest = new DownloadManifest();
            manifest.id = id;
            manifest.title = req.optString("title", "");
            manifest.poster = req.optString("poster", "");
            manifest.label = req.optString("label", "");
            manifest.container = req.optString("container", "ts");
            manifest.hasAudio = req.optBoolean("hasAudio", false);
            manifest.estBytes = req.optLong("estBytes", -1);
            manifest.createdAt = System.currentTimeMillis();
            manifest.updatedAt = System.currentTimeMillis();
            manifest.status = "queued";
            manifest.path = req.optString("url", "");
        }

        if (!checkSpace(folder, manifest.estBytes)) {
            manifest.status = "failed";
            manifest.errorCode = "NO_SPACE";
            manifest.error = "Insufficient storage space";
            manifest.save(folder);
            notifyError(id, "NO_SPACE", "Insufficient storage space");
            return;
        }

        String qualityUrl = req.optString("url", "");
        if (qualityUrl.isEmpty()) {
            manifest.status = "failed";
            manifest.errorCode = "INVALID";
            manifest.error = "Missing quality URL";
            manifest.save(folder);
            notifyError(id, "INVALID", "Missing quality URL");
            return;
        }

        manifest.status = "downloading";
        manifest.updatedAt = System.currentTimeMillis();
        manifest.save(folder);

        DownloadTask task = new DownloadTask(id, folder, manifest, qualityUrl, req);
        activeTasks.put(id, task);
        notifyStarted(id);
        task.run();
        activeTasks.remove(id);
    }

    private boolean checkSpace(File folder, long estBytes) {
        if (estBytes <= 0) return true;
        try {
            StatFs stat = new StatFs(folder.getAbsolutePath());
            long freeBytes = stat.getAvailableBytes();
            long required = Math.round(estBytes * 1.1);
            return freeBytes >= required;
        } catch (Exception e) {
            return true;
        }
    }

    private void deleteFolder(File folder) {
        if (folder != null && folder.exists()) {
            File[] files = folder.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.isDirectory()) {
                        deleteFolder(f);
                    } else {
                        f.delete();
                    }
                }
            }
            folder.delete();
        }
    }

    private void notifyStarted(String id) {
        if (listener != null) {
            listener.onStarted(id);
        }
    }

    private void notifyProgress(String id, int percent, long bytesDone, long speedBps, int segDone, int segTotal, long etaSec) {
        if (listener != null) {
            JSONObject p = new JSONObject();
            try {
                p.put("id", id);
                p.put("percent", percent);
                p.put("bytesDone", bytesDone);
                p.put("speedBps", speedBps);
                p.put("segDone", segDone);
                p.put("segTotal", segTotal);
                p.put("etaSec", etaSec);
            } catch (JSONException ignored) {}
            listener.onProgress(p);
        }
    }

    private void notifyPaused(String id) {
        if (listener != null) {
            listener.onPaused(id);
        }
    }

    private void notifyComplete(String id, String path, long size) {
        if (listener != null) {
            listener.onComplete(id, path, size);
        }
    }

    private void notifyError(String id, String code, String msg) {
        if (listener != null) {
            listener.onError(id, code, msg);
        }
    }

    private class DownloadTask {
        private final String id;
        private final File folder;
        private final DownloadManifest manifest;
        private final String qualityUrl;
        private final JSONObject originalReq;
        private String audioUrl;
        private final AtomicBoolean paused = new AtomicBoolean(false);
        private final AtomicBoolean cancelled = new AtomicBoolean(false);
        private final AtomicInteger consecutiveAuthErrors = new AtomicInteger(0);
        private Future<?> downloadFuture;
        private long lastProgressTime = 0;
        private long lastProgressBytes = 0;

        DownloadTask(String id, File folder, DownloadManifest manifest, String qualityUrl, JSONObject originalReq) {
            this.id = id;
            this.folder = folder;
            this.manifest = manifest;
            this.qualityUrl = qualityUrl;
            this.originalReq = originalReq;
            JSONObject q = originalReq.optJSONObject("quality");
            if (q != null) {
                try {
                    this.audioUrl = q.getString("audioUrl");
                } catch (JSONException ignored) {}
            }
        }

        void pause() {
            paused.set(true);
            manifest.status = "paused";
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            notifyPaused(id);
        }

        void resume(JSONObject newReq) {
            paused.set(false);
            manifest.status = "downloading";
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            if (downloadFuture == null || downloadFuture.isDone()) {
                downloadFuture = executor.submit(() -> downloadSegments(audioUrl));
            }
        }

        void cancel() {
            cancelled.set(true);
            paused.set(true);
        }

        void run() {
            String referer = originalReq.optString("referer", "");
            String ua = originalReq.optString("userAgent", "");
            String cookie = originalReq.optString("cookie", "");

            Map<String, String> headers = HttpUtil.buildHeaders(ua, referer, null, cookie);

            HttpUtil.Result result = HttpUtil.fetchText(qualityUrl, headers);
            if (result.code != 200) {
                fail("NETWORK", "Failed to fetch playlist: HTTP " + result.code);
                return;
            }

            PlaylistParser.Parsed parsed = PlaylistParser.parseMedia(result.body, qualityUrl);
            if (parsed.keyMethod != null && !"NONE".equalsIgnoreCase(parsed.keyMethod)) {
                fail("ENCRYPTED", "Encrypted streams not supported");
                return;
            }
            if (!parsed.endList) {
                fail("LIVE", "Live streams not supported");
                return;
            }
            if (parsed.hasByteRange) {
                fail("UNSUPPORTED", "Byte range segments not supported");
                return;
            }

            manifest.segTotal = parsed.segmentUrls.size();
            manifest.container = parsed.container;
            if (manifest.estBytes <= 0 && parsed.totalDuration > 0) {
                long bw = originalReq.optLong("bandwidth", 0);
                if (bw > 0) {
                    manifest.estBytes = Math.round((bw * parsed.totalDuration) / 8.0);
                }
            }

            if (audioUrl != null && !audioUrl.isEmpty()) {
                manifest.hasAudio = true;
                manifest.audioSegTotal = 0;
                manifest.audioSegDone = 0;
            }
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);

            downloadSegments(audioUrl);
        }

        private void downloadSegments(String audioUrl) {
            String referer = originalReq.optString("referer", "");
            String ua = originalReq.optString("userAgent", "");
            String cookie = originalReq.optString("cookie", "");
            Map<String, String> headers = HttpUtil.buildHeaders(ua, referer, null, cookie);

            if (manifest.initUrl == null && manifest.path != null && !manifest.path.isEmpty()) {
                manifest.initUrl = originalReq.optString("initUrl", "");
            }

            HttpUtil.Result playlistResult = HttpUtil.fetchText(qualityUrl, headers);
            if (playlistResult.code != 200) {
                fail("NETWORK", "Failed to fetch playlist: HTTP " + playlistResult.code);
                return;
            }
            PlaylistParser.Parsed parsed = PlaylistParser.parseMedia(playlistResult.body, qualityUrl);
            parsedSegmentUrls = parsed.segmentUrls;

            final File[] audioDirRef = {null};
            final Object[] audioSegmentUrlsRef = {null};
            final String[] audioInitUrlRef = {null};

            if (audioUrl != null && !audioUrl.isEmpty()) {
                HttpUtil.Result audioResult = HttpUtil.fetchText(audioUrl, headers);
                if (audioResult.code != 200) {
                    fail("AUDIO_NETWORK", "Failed to fetch audio playlist: HTTP " + audioResult.code);
                    return;
                }
                PlaylistParser.Parsed audioParsed = PlaylistParser.parseMedia(audioResult.body, audioUrl);
                if (audioParsed.keyMethod != null && !"NONE".equalsIgnoreCase(audioParsed.keyMethod)) {
                    fail("AUDIO_ENCRYPTED", "Audio stream encrypted");
                    return;
                }
                if (!audioParsed.endList) {
                    fail("AUDIO_LIVE", "Audio stream is live");
                    return;
                }
                if (audioParsed.hasByteRange) {
                    fail("AUDIO_UNSUPPORTED", "Audio byte range not supported");
                    return;
                }
                audioDirRef[0] = new File(folder, "audio");
                if (!audioDirRef[0].exists()) {
                    audioDirRef[0].mkdirs();
                }
                audioSegmentUrlsRef[0] = audioParsed.segmentUrls;
                audioInitUrlRef[0] = audioParsed.initUrl;
                manifest.audioSegTotal = ((List<String>) audioSegmentUrlsRef[0]).size();
                manifest.save(folder);
            }

            ExecutorService workers = Executors.newFixedThreadPool(WORKER_THREADS);
            List<Future<?>> futures = new ArrayList<>();

            final long[] lastProgressBytes = {0};
            final long[] lastProgressTime = {System.currentTimeMillis()};
            final long[] speedWindowBytes = new long[5];
            final int[] speedWindowIndex = {0};

            Runnable progressTask = () -> {
                if (cancelled.get()) return;
                synchronized (manifest) {
                    long bytesDone = manifest.bytesDone;
                    int segDone = manifest.segDone;
                    int segTotal = manifest.segTotal;
                    int audioSegDone = manifest.audioSegDone;
                    int audioSegTotal = manifest.audioSegTotal;

                    long now = System.currentTimeMillis();
                    long elapsedMs = now - lastProgressTime[0];
                    if (elapsedMs > 0) {
                        long deltaBytes = bytesDone - lastProgressBytes[0];
                        speedWindowBytes[speedWindowIndex[0]] = deltaBytes;
                        speedWindowIndex[0] = (speedWindowIndex[0] + 1) % 5;
                        lastProgressBytes[0] = bytesDone;
                        lastProgressTime[0] = now;
                    }

                    long totalSpeed = 0;
                    for (long b : speedWindowBytes) totalSpeed += b;
                    long speedBps = totalSpeed / 5;

                    int totalSegs = segTotal + audioSegTotal;
                    int doneSegs = segDone + audioSegDone;
                    int percent = totalSegs > 0 ? (doneSegs * 100 / totalSegs) : 0;
                    long etaSec = speedBps > 0 && manifest.estBytes > 0 ? (manifest.estBytes - bytesDone) / speedBps : 0;

                    notifyProgress(id, percent, bytesDone, speedBps, doneSegs, totalSegs, etaSec);
                }
            };

            Runnable saveTask = () -> {
                if (!cancelled.get() && !paused.get()) {
                    manifest.updatedAt = System.currentTimeMillis();
                    manifest.save(folder);
                }
            };

            ScheduledFuture<?> progressFuture = timerExecutor.scheduleAtFixedRate(progressTask, PROGRESS_INTERVAL_MS, PROGRESS_INTERVAL_MS, TimeUnit.MILLISECONDS);
            ScheduledFuture<?> saveFuture = timerExecutor.scheduleAtFixedRate(saveTask, SAVE_INTERVAL_MS, SAVE_INTERVAL_MS, TimeUnit.MILLISECONDS);

            try {
                if (manifest.initUrl != null && !manifest.initUrl.isEmpty()) {
                    File initFile = new File(folder, "init.mp4");
                    if (!initFile.exists()) {
                        downloadWithRetries(manifest.initUrl, headers, initFile, -1);
                    }
                }
                if (audioInitUrlRef[0] != null && !audioInitUrlRef[0].isEmpty() && audioDirRef[0] != null) {
                    File audioInitFile = new File(audioDirRef[0], "init.mp4");
                    if (!audioInitFile.exists()) {
                        downloadWithRetries(audioInitUrlRef[0], headers, audioInitFile, -1);
                    }
                }

                for (int i = 0; i < manifest.segTotal; i++) {
                    if (cancelled.get()) break;
                    while (paused.get() && !cancelled.get()) {
                        Thread.sleep(200);
                    }
                    if (cancelled.get()) break;

                    final int segIndex = i;
                    futures.add(workers.submit(() -> {
                        if (cancelled.get()) return;
                        String segUrl = parsedSegmentUrls.get(segIndex);
                        File partFile = new File(folder, String.format("seg_%05d.part", segIndex));
                        File finalFile = new File(folder, String.format("seg_%05d.seg", segIndex));
                        if (finalFile.exists()) {
                            synchronized (manifest) {
                                manifest.segDone++;
                                manifest.bytesDone += finalFile.length();
                                manifest.updatedAt = System.currentTimeMillis();
                            }
                            return;
                        }
                        int code = downloadWithRetries(segUrl, headers, partFile, segIndex);
                        if (code >= 200 && code < 300) {
                            if (partFile.renameTo(finalFile)) {
                                synchronized (manifest) {
                                    manifest.segDone++;
                                    manifest.bytesDone += finalFile.length();
                                    manifest.updatedAt = System.currentTimeMillis();
                                }
                            }
                        } else if (code == 401 || code == 403 || code == 410) {
                            consecutiveAuthErrors.incrementAndGet();
                        } else {
                            consecutiveAuthErrors.set(0);
                        }
                    }));
                }

                if (audioSegmentUrlsRef[0] != null && audioDirRef[0] != null) {
                    final List<String> audioSegUrls = (List<String>) audioSegmentUrlsRef[0];
                    for (int i = 0; i < audioSegUrls.size(); i++) {
                        if (cancelled.get()) break;
                        while (paused.get() && !cancelled.get()) {
                            Thread.sleep(200);
                        }
                        if (cancelled.get()) break;

                        final int segIndex = i;
                        final File audioDir = audioDirRef[0];
                        futures.add(workers.submit(() -> {
                            if (cancelled.get()) return;
                            String segUrl = audioSegUrls.get(segIndex);
                            File partFile = new File(audioDir, String.format("seg_%05d.part", segIndex));
                            File finalFile = new File(audioDir, String.format("seg_%05d.seg", segIndex));
                            if (finalFile.exists()) {
                                synchronized (manifest) {
                                    manifest.audioSegDone++;
                                    manifest.bytesDone += finalFile.length();
                                    manifest.updatedAt = System.currentTimeMillis();
                                }
                                return;
                            }
                            int code = downloadWithRetries(segUrl, headers, partFile, segIndex);
                            if (code >= 200 && code < 300) {
                                if (partFile.renameTo(finalFile)) {
                                    synchronized (manifest) {
                                        manifest.audioSegDone++;
                                        manifest.bytesDone += finalFile.length();
                                        manifest.updatedAt = System.currentTimeMillis();
                                    }
                                }
                            } else if (code == 401 || code == 403 || code == 410) {
                                consecutiveAuthErrors.incrementAndGet();
                            } else {
                                consecutiveAuthErrors.set(0);
                            }
                        }));
                    }
                }

                for (Future<?> f : futures) {
                    try {
                        f.get();
                    } catch (Exception ignored) {}
                }

                workers.shutdown();
                workers.awaitTermination(1, TimeUnit.HOURS);

                progressFuture.cancel(false);
                saveFuture.cancel(false);

                boolean videoDone = manifest.segDone == manifest.segTotal;
                boolean audioDone = !manifest.hasAudio || manifest.audioSegDone == manifest.audioSegTotal;
                if (!cancelled.get() && videoDone && audioDone) {
                    complete();
                } else if (cancelled.get()) {
                    manifest.status = "failed";
                    manifest.errorCode = "CANCELLED";
                    manifest.error = "Download cancelled";
                    manifest.save(folder);
                }

            } catch (Exception e) {
                progressFuture.cancel(false);
                saveFuture.cancel(false);
                fail("NETWORK", e.getMessage());
            } finally {
                workers.shutdownNow();
            }
        }

        private List<String> parsedSegmentUrls;

        private int downloadWithRetries(String url, Map<String, String> headers, File dest, int segIndex) {
            for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (cancelled.get()) return 0;
                while (paused.get() && !cancelled.get()) {
                    try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                }
                if (cancelled.get()) return 0;

                try {
                    AtomicLong bytes = new AtomicLong(0);
                    int code = HttpUtil.downloadToFile(url, headers, dest, cancelled, bytes);
                    if (code >= 200 && code < 300) {
                        consecutiveAuthErrors.set(0);
                        return code;
                    }
                    if (code == 401 || code == 403 || code == 410) {
                        int count = consecutiveAuthErrors.incrementAndGet();
                        if (count >= CONSECUTIVE_AUTH_ERRORS_LIMIT) {
                            fail("EXPIRED", "Stream expired or access denied");
                            return code;
                        }
                    }
                    if (attempt < MAX_RETRIES) {
                        Thread.sleep(RETRY_DELAYS_MS[attempt]);
                    }
                } catch (IOException e) {
                    if (attempt < MAX_RETRIES) {
                        try { Thread.sleep(RETRY_DELAYS_MS[attempt]); } catch (InterruptedException ignored) {}
                    }
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    return 0;
                }
            }
            return 0;
        }

        private void complete() {
            manifest.status = "done";
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);

            String referer = originalReq.optString("referer", "");
            String ua = originalReq.optString("userAgent", "");
            String cookie = originalReq.optString("cookie", "");
            Map<String, String> headers = HttpUtil.buildHeaders(ua, referer, null, cookie);

            try {
                Finalizer.run(folder, manifest, listener);
            } catch (Exception e) {
                Log.e(TAG, "Finalizer error", e);
            }

            notifyComplete(id, folder.getAbsolutePath(), manifest.size);
        }

        private void fail(String code, String msg) {
            manifest.status = "failed";
            manifest.errorCode = code;
            manifest.error = msg;
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            notifyError(id, code, msg);
        }
    }
}