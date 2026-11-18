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
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    private void notifyProgress(String id, int percent, long bytesDone, long totalBytes, long speedBps, int segDone, int segTotal, long etaSec) {
        if (listener != null) {
            JSONObject p = new JSONObject();
            try {
                p.put("id", id);
                p.put("percent", percent);
                p.put("bytesDone", bytesDone);
                p.put("totalBytes", totalBytes);
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
        private final Set<Integer> failedSegs = Collections.synchronizedSet(new HashSet<Integer>());
        private Future<?> downloadFuture;
        private long[] lastProgressBytesRef;
        private long[] lastProgressTimeRef;
        private long[] speedWindowBytes;
        private int[] speedWindowIndex;
        private volatile long lastSpeedBps = 0;
        private final AtomicBoolean firstSegmentLogged = new AtomicBoolean(false);
        private long downloadStartMs = 0;
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
            HttpUtil.disconnectAll();
            manifest.status = "paused";
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            notifyPaused(id);
        }

        void resume(JSONObject newReq) {
            paused.set(false);
            if (speedWindowBytes != null) {
                synchronized (manifest) {
                    java.util.Arrays.fill(speedWindowBytes, 0);
                    speedWindowIndex[0] = 0;
                    lastProgressBytesRef[0] = manifest.bytesDone;
                    lastProgressTimeRef[0] = System.currentTimeMillis();
                }
            }
            Log.d("Downloader", "Download resumed: " + id);
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
            HttpUtil.disconnectAll();
        }

        void run() {
            String referer = originalReq.optString("referer", "");
            String ua = originalReq.optString("userAgent", "");
            String cookie = originalReq.optString("cookie", "");

            Map<String, String> headers = HttpUtil.buildHeaders(ua, referer, null, cookie);

            HttpUtil.Result result = HttpUtil.fetchText(qualityUrl, headers);
            if (result.code != 200) {
                if (paused.get() || cancelled.get()) return;
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
            if (!"fmp4".equals(manifest.container)) {
                manifest.container = parsed.container;
            }
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
                if (paused.get() || cancelled.get()) return;
                fail("NETWORK", "Failed to fetch playlist: HTTP " + playlistResult.code);
                return;
            }
            PlaylistParser.Parsed parsed = PlaylistParser.parseMedia(playlistResult.body, qualityUrl);
            parsedSegmentUrls = parsed.segmentUrls;

            String requestedInit = originalReq.optString("initUrl", "");
            boolean initFromPlaylist = requestedInit.isEmpty()
                    && parsed.initUrl != null && !parsed.initUrl.isEmpty();
            if (initFromPlaylist) {
                manifest.initUrl = parsed.initUrl;
                manifest.container = "fmp4";
                manifest.updatedAt = System.currentTimeMillis();
                manifest.save(folder);
            }
            Log.d("Downloader", "INIT from playlist=" + initFromPlaylist);

            final File[] audioDirRef = {null};
            final Object[] audioSegmentUrlsRef = {null};
            final String[] audioInitUrlRef = {null};

            if (audioUrl != null && !audioUrl.isEmpty()) {
                HttpUtil.Result audioResult = HttpUtil.fetchText(audioUrl, headers);
                if (audioResult.code != 200) {
                    if (paused.get() || cancelled.get()) return;
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

            synchronized (manifest) {
                manifest.segDone = countSegFiles(folder, manifest.segTotal);
                long onDisk = bytesOnDisk(folder);
                if (manifest.hasAudio && audioDirRef[0] != null) {
                    manifest.audioSegDone = countSegFiles(audioDirRef[0], manifest.audioSegTotal);
                    onDisk += bytesOnDisk(audioDirRef[0]);
                } else {
                    manifest.audioSegDone = 0;
                }
                manifest.bytesDone = onDisk;
                manifest.updatedAt = System.currentTimeMillis();
                manifest.save(folder);
            }

            ExecutorService workers = Executors.newFixedThreadPool(WORKER_THREADS);
            List<Future<?>> futures = new ArrayList<>();

            final long[] lastProgressBytes = {manifest.bytesDone};
            final long[] lastProgressTime = {System.currentTimeMillis()};
            final long[] speedWindowBytes = new long[5];
            final int[] speedWindowIndex = {0};
            this.lastProgressBytesRef = lastProgressBytes;
            this.lastProgressTimeRef = lastProgressTime;
            this.speedWindowBytes = speedWindowBytes;
            this.speedWindowIndex = speedWindowIndex;

            Runnable progressTask = () -> {
                if (cancelled.get() || paused.get()) return;
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
                    lastSpeedBps = speedBps;

                    int totalSegs = segTotal + audioSegTotal;
                    int doneSegs = segDone + audioSegDone;
                    int percent = totalSegs > 0 ? (doneSegs * 100 / totalSegs) : 0;
                    long totalBytes = manifest.estBytes;
                    if (doneSegs >= 3 && totalSegs > 0) {
                        totalBytes = (bytesDone * (long) totalSegs) / doneSegs;
                        manifest.estBytes = totalBytes;
                    }
                    long etaSec = speedBps > 0 && totalBytes > 0 ? (totalBytes - bytesDone) / speedBps : 0;
                    if (etaSec < 0) etaSec = 0;

                    notifyProgress(id, percent, bytesDone, totalBytes, speedBps, doneSegs, totalSegs, etaSec);
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
                if ("fmp4".equals(manifest.container)) {
                    File initFile = new File(folder, "init.mp4");
                    if (manifest.initUrl == null || manifest.initUrl.isEmpty()) {
                        Log.d("Downloader", "fmp4 without init");
                    } else if (!initFile.exists()) {
                        int initCode = downloadWithRetries(manifest.initUrl, headers, initFile, -1);
                        if (cancelled.get()) return;
                        if (initCode < 200 || initCode >= 300 || !initFile.exists() || initFile.length() <= 0) {
                            progressFuture.cancel(false);
                            saveFuture.cancel(false);
                            fail("INIT_MISSING", "Init segment download failed");
                            return;
                        }
                    }
                }
                if (audioInitUrlRef[0] != null && !audioInitUrlRef[0].isEmpty() && audioDirRef[0] != null) {
                    File audioInitFile = new File(audioDirRef[0], "init.mp4");
                    if (!audioInitFile.exists()) {
                        downloadWithRetries(audioInitUrlRef[0], headers, audioInitFile, -1);
                    }
                }

                downloadStartMs = System.currentTimeMillis();
                for (int i = 0; i < manifest.segTotal; i++) {
                    if (cancelled.get()) break;
                    while (paused.get() && !cancelled.get()) {
                        Thread.sleep(200);
                    }
                    if (cancelled.get()) break;

                    File existingVideo = new File(folder, String.format("seg_%05d.seg", i));
                    if (existingVideo.exists() && existingVideo.length() > 0) continue;

                    final int segIndex = i;
                    futures.add(workers.submit(() -> {
                        if (cancelled.get()) return;
                        String segUrl = parsedSegmentUrls.get(segIndex);
                        File partFile = new File(folder, String.format("seg_%05d.seg.part", segIndex));
                        File finalFile = new File(folder, String.format("seg_%05d.seg", segIndex));
                        if (finalFile.exists() && finalFile.length() > 0) {
                            return;
                        }
                        if (finalFile.exists()) {
                            finalFile.delete();
                        }
                        int code = downloadWithRetries(segUrl, headers, partFile, segIndex);
                        if (code >= 200 && code < 300 && partFile.length() > 0 && partFile.renameTo(finalFile)) {
                            synchronized (manifest) {
                                failedSegs.remove(segIndex);
                                manifest.segDone++;
                                manifest.bytesDone += finalFile.length();
                                manifest.updatedAt = System.currentTimeMillis();
                                onSegCompleted(manifest.segDone, manifest.segTotal);
                            }
                        } else if (code == 0) {
                            if (!cancelled.get()) failedSegs.add(segIndex);
                            partFile.delete();
                        } else if (code == 401 || code == 403 || code == 410) {
                            consecutiveAuthErrors.incrementAndGet();
                            partFile.delete();
                        } else {
                            consecutiveAuthErrors.set(0);
                            partFile.delete();
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

                        File existingAudio = new File(audioDirRef[0], String.format("seg_%05d.seg", i));
                        if (existingAudio.exists() && existingAudio.length() > 0) continue;

                        final int segIndex = i;
                        final File audioDir = audioDirRef[0];
                        futures.add(workers.submit(() -> {
                            if (cancelled.get()) return;
                            String segUrl = audioSegUrls.get(segIndex);
                            File partFile = new File(audioDir, String.format("seg_%05d.seg.part", segIndex));
                            File finalFile = new File(audioDir, String.format("seg_%05d.seg", segIndex));
                            if (finalFile.exists() && finalFile.length() > 0) {
                                return;
                            }
                            if (finalFile.exists()) {
                                finalFile.delete();
                            }
                            int code = downloadWithRetries(segUrl, headers, partFile, segIndex);
                            if (code >= 200 && code < 300 && partFile.length() > 0 && partFile.renameTo(finalFile)) {
                                synchronized (manifest) {
                                    failedSegs.remove(-(segIndex + 1));
                                    manifest.audioSegDone++;
                                    manifest.bytesDone += finalFile.length();
                                    manifest.updatedAt = System.currentTimeMillis();
                                    onSegCompleted(manifest.segDone + manifest.audioSegDone, manifest.segTotal + manifest.audioSegTotal);
                                }
                            } else if (code == 0) {
                                if (!cancelled.get()) failedSegs.add(-(segIndex + 1));
                                partFile.delete();
                            } else if (code == 401 || code == 403 || code == 410) {
                                consecutiveAuthErrors.incrementAndGet();
                                partFile.delete();
                            } else {
                                consecutiveAuthErrors.set(0);
                                partFile.delete();
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

                if (!cancelled.get()) {
                    for (int pass = 0; pass < 2; pass++) {
                        boolean anyMissing = false;
                        for (int i = 0; i < manifest.segTotal && !cancelled.get(); i++) {
                            File f = new File(folder, String.format("seg_%05d.seg", i));
                            if (f.exists() && f.length() > 0) continue;
                            anyMissing = true;
                            if (parsedSegmentUrls != null && i < parsedSegmentUrls.size()) {
                                fetchInto(parsedSegmentUrls.get(i), headers, folder, i);
                            }
                        }
                        if (audioDirRef[0] != null && audioSegmentUrlsRef[0] != null) {
                            final List<String> audioUrls = (List<String>) audioSegmentUrlsRef[0];
                            for (int i = 0; i < audioUrls.size() && !cancelled.get(); i++) {
                                File f = new File(audioDirRef[0], String.format("seg_%05d.seg", i));
                                if (f.exists() && f.length() > 0) continue;
                                anyMissing = true;
                                fetchInto(audioUrls.get(i), headers, audioDirRef[0], i);
                            }
                        }
                        if (!anyMissing) break;
                    }
                    synchronized (manifest) {
                        manifest.segDone = countSegFiles(folder, manifest.segTotal);
                        if (manifest.hasAudio) {
                            manifest.audioSegDone = countSegFiles(new File(folder, "audio"), manifest.audioSegTotal);
                        }
                        manifest.updatedAt = System.currentTimeMillis();
                        manifest.save(folder);
                    }
                }

                progressFuture.cancel(false);
                saveFuture.cancel(false);

                int missing = (manifest.segTotal - manifest.segDone)
                        + (manifest.hasAudio ? manifest.audioSegTotal - manifest.audioSegDone : 0);
                boolean videoDone = manifest.segDone == manifest.segTotal;
                boolean audioDone = !manifest.hasAudio || manifest.audioSegDone == manifest.audioSegTotal;
                if (!cancelled.get() && videoDone && audioDone) {
                    complete();
                } else if (cancelled.get()) {
                    manifest.status = "failed";
                    manifest.errorCode = "CANCELLED";
                    manifest.error = "Download cancelled";
                    manifest.save(folder);
                } else {
                    fail("INCOMPLETE", "Incomplete: " + Math.max(missing, 1) + " segments missing");
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
            String host = hostOnly(url);
            long expected = contentLength(url, headers);
            for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (cancelled.get()) return 0;
                while (paused.get() && !cancelled.get()) {
                    try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                }
                if (cancelled.get()) return 0;

                try {
                    dest.delete();
                    AtomicLong bytes = new AtomicLong(0);
                    int code = HttpUtil.downloadToFile(url, headers, dest, cancelled, paused, bytes);
                    if (code >= 200 && code < 300) {
                        long written = dest.length();
                        if (written > 0 && (expected <= 0 || written == expected)) {
                            consecutiveAuthErrors.set(0);
                            if (segIndex >= 0 && firstSegmentLogged.compareAndSet(false, true)) {
                                Log.d("Downloader", "SEG first ok idx=" + segIndex + " bytes=" + bytes.get() + " ms=" + (System.currentTimeMillis() - downloadStartMs));
                            }
                            return code;
                        }
                        if (segIndex >= 0) Log.d("Downloader", "SEG short idx=" + segIndex + " bytes=" + written + " expected=" + expected + " attempt=" + attempt);
                        dest.delete();
                    }
                    if (segIndex >= 0) Log.d("Downloader", "SEG fail idx=" + segIndex + " http=" + code + " attempt=" + attempt + " host=" + host);
                    dest.delete();
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
                } catch (HttpUtil.PausedException e) {
                    dest.delete();
                    attempt--;
                    while (paused.get() && !cancelled.get()) {
                        try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                    }
                } catch (IOException e) {
                    dest.delete();
                    if (cancelled.get()) return 0;
                    if (segIndex >= 0) Log.d("Downloader", "SEG error idx=" + segIndex + " attempt=" + attempt + " " + e.getClass().getSimpleName() + " " + e.getMessage());
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

        private long contentLength(String url, Map<String, String> headers) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestMethod("HEAD");
                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
                int code = connection.getResponseCode();
                if (code < 200 || code >= 400) return -1;
                long length = connection.getContentLengthLong();
                return length > 0 ? length : -1;
            } catch (Exception e) {
                return -1;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        private boolean fetchInto(String url, Map<String, String> headers, File dir, int index) {
            File partFile = new File(dir, String.format("seg_%05d.seg.part", index));
            File finalFile = new File(dir, String.format("seg_%05d.seg", index));
            int code = downloadWithRetries(url, headers, partFile, index);
            if (code >= 200 && code < 300 && partFile.length() > 0 && partFile.renameTo(finalFile)) {
                failedSegs.remove(index);
                failedSegs.remove(-(index + 1));
                return true;
            }
            partFile.delete();
            return false;
        }

        private int countSegFiles(File dir, int total) {
            int count = 0;
            for (int i = 0; i < total; i++) {
                File f = new File(dir, String.format("seg_%05d.seg", i));
                if (f.exists() && f.length() > 0) count++;
            }
            return count;
        }

        private long bytesOnDisk(File dir) {
            long total = 0;
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    String name = f.getName();
                    if (f.isFile() && name.startsWith("seg_") && name.endsWith(".seg")) {
                        total += f.length();
                    }
                }
            }
            return total;
        }

        private String hostOnly(String url) {
            try { return new java.net.URL(url).getHost(); } catch (Exception e) { return ""; }
        }

        private void onSegCompleted(int done, int total) {
            if (done > 0 && done % 10 == 0) {
                Log.d("Downloader", "SEGS done=" + done + "/" + total + " bytes=" + manifest.bytesDone + " speedBps=" + lastSpeedBps);
            }
        }

        private void complete() {
            Log.d("Downloader", "Finalize start " + id + " container=" + manifest.container);

            String referer = originalReq.optString("referer", "");
            String ua = originalReq.optString("userAgent", "");
            String cookie = originalReq.optString("cookie", "");
            Map<String, String> headers = HttpUtil.buildHeaders(ua, referer, null, cookie);

            try {
                Finalizer.run(folder, manifest, manifest.segTotal, manifest.audioSegTotal, listener);
            } catch (Exception e) {
                String message = e.getMessage() != null ? e.getMessage() : "Finalize failed";
                String code = message.startsWith("Incomplete") ? "INCOMPLETE" : "MUX_FAILED";
                manifest.status = "failed";
                manifest.errorCode = code;
                manifest.error = message;
                manifest.updatedAt = System.currentTimeMillis();
                manifest.save(folder);
                notifyError(id, code, message);
                Log.d("Downloader", "Finalize end " + id + " container=" + manifest.container);
                return;
            }

            Log.d("Downloader", "Finalize end " + id + " container=" + manifest.container);

            if ("failed".equals(manifest.status)) {
                return;
            }

            File outFile = new File(folder, "movie.mp4");
            if (!outFile.exists() || outFile.length() <= 0) {
                manifest.status = "failed";
                manifest.errorCode = "FINALIZE_EMPTY";
                manifest.error = "Output file is empty or missing";
                manifest.updatedAt = System.currentTimeMillis();
                manifest.save(folder);
                notifyError(id, "FINALIZE_EMPTY", "Output file is empty or missing");
                return;
            }

            notifyComplete(id, outFile.getAbsolutePath(), manifest.size);
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