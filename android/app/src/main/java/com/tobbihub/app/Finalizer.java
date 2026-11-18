package com.tobbihub.app;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaMetadataRetriever;
import android.os.StatFs;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Finalizer {
    private static final int BUFFER_SIZE = 1024 * 1024;

    public static void run(File dir, DownloadManifest m, int segTotal, int audioSegTotal, DownloadEngine.Listener l) throws Exception {
        String sniffed = sniffContainer(dir);
        if (sniffed != null) {
            m.container = sniffed;
        }
        checkFreeSpaceForOutput(dir, m);
        boolean remuxInputsReady = "fmp4".equals(m.container) && m.hasAudio
                && isNonEmpty(new File(dir, "video.mp4"))
                && isNonEmpty(new File(dir, "audio.mp4"));
        if (!remuxInputsReady) {
            verifySegments(dir, segTotal, "video");
            if (m.hasAudio) {
                verifySegments(new File(dir, "audio"), audioSegTotal, "audio");
            }
        }
        if ("fmp4".equals(m.container) && m.hasAudio) {
            handleFmp4WithAudio(dir, m, l);
        } else if ("ts".equals(m.container)) {
            handleTsContainer(dir, m, l);
        } else if ("fmp4".equals(m.container) && !m.hasAudio) {
            handleFmp4VideoOnly(dir, m, l);
        } else {
            throw new IllegalStateException("Container not supported: " + m.container);
        }
    }

    private static void verifySegments(File dir, int total, String label) {
        int missing = 0;
        for (int i = 0; i < total; i++) {
            File f = new File(dir, String.format("seg_%05d.seg", i));
            if (!f.exists() || f.length() <= 0) {
                missing++;
            }
        }
        if (missing > 0 || total <= 0) {
            throw new IllegalStateException("Incomplete: " + Math.max(missing, 1) + " " + label + " segments missing");
        }
    }

    private static boolean isNonEmpty(File file) {
        return file != null && file.exists() && file.length() > 0;
    }

    private static void checkFreeSpaceForOutput(File dir, DownloadManifest m) {
        long videoBytes = estimatedVideoBytes(dir, m);
        long audioBytes = estimatedAudioBytes(dir, m);
        long totalBytes = videoBytes + audioBytes;
        if (totalBytes <= 0) {
            return;
        }
        long requiredBytes = (totalBytes * 115 + 99) / 100;
        long freeBytes;
        try {
            freeBytes = new StatFs(dir.getAbsolutePath()).getAvailableBytes();
        } catch (Exception e) {
            return;
        }
        if (freeBytes < requiredBytes) {
            long needMb = (requiredBytes + (1024 * 1024) - 1) / (1024 * 1024);
            throw new IllegalStateException("Not enough storage to finish: need " + needMb + " MB");
        }
    }

    private static long estimatedVideoBytes(File dir, DownloadManifest m) {
        if ("fmp4".equals(m.container) && m.hasAudio) {
            File video = new File(dir, "video.mp4");
            if (isNonEmpty(video)) {
                return video.length();
            }
        } else if ("fmp4".equals(m.container)) {
            File raw = new File(dir, "movie_raw.mp4");
            if (isNonEmpty(raw)) {
                return raw.length();
            }
        } else if ("ts".equals(m.container)) {
            File ts = new File(dir, "movie.ts");
            if (isNonEmpty(ts)) {
                return ts.length();
            }
        }
        return concatInputBytes(dir);
    }

    private static long estimatedAudioBytes(File dir, DownloadManifest m) {
        if (!"fmp4".equals(m.container) || !m.hasAudio) {
            return 0;
        }
        File audio = new File(dir, "audio.mp4");
        if (isNonEmpty(audio)) {
            return audio.length();
        }
        return concatInputBytes(new File(dir, "audio"));
    }

    private static long concatInputBytes(File dir) {
        long total = 0;
        File[] files = dir.listFiles();
        if (files == null) {
            return 0;
        }
        for (File f : files) {
            String name = f.getName();
            if (f.isFile() && (name.equals("init.mp4") || name.equals("init.ts")
                    || (name.startsWith("seg_") && name.endsWith(".seg")))) {
                total += f.length();
            }
        }
        return total;
    }

    private static void handleFmp4WithAudio(File dir, DownloadManifest m, DownloadEngine.Listener l) throws Exception {
        File videoDir = dir;
        File audioDir = new File(dir, "audio");

        File videoMp4 = new File(dir, "video.mp4");
        File audioMp4 = new File(dir, "audio.mp4");

        if (!isNonEmpty(videoMp4) || !isNonEmpty(audioMp4)) {
            File videoInit = new File(videoDir, "init.mp4");
            File audioInit = new File(audioDir, "init.mp4");

            if (!videoInit.exists() || videoInit.length() <= 0) {
                failInitMissing(dir, m, l);
                return;
            }
            if (!audioInit.exists() || audioInit.length() <= 0) {
                failInitMissing(dir, m, l);
                return;
            }

            List<File> videoSegs = collectSegments(videoDir);
            List<File> audioSegs = collectSegments(audioDir);

            concatenateFiles(videoInit, videoSegs, videoMp4, true);
            concatenateFiles(audioInit, audioSegs, audioMp4, true);
        }

        File outFile = new File(dir, "movie.mp4");
        remuxMp4(videoMp4, audioMp4, outFile, m, l);

        if (!outFile.exists() || outFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        m.status = "done";
        m.path = outFile.getAbsolutePath();
        m.size = outFile.length();
        m.save(dir);

        deleteIntermediates(dir, audioDir, videoMp4, audioMp4);
        logOutput(outFile);
    }

    private static void handleTsContainer(File dir, DownloadManifest m, DownloadEngine.Listener l) throws Exception {
        List<File> segFiles = collectSegments(dir);
        if (segFiles.isEmpty()) {
            throw new IllegalStateException("No TS segments found");
        }

        File tsFile = new File(dir, "movie.ts");
        File initFile = new File(dir, "init.ts");
        boolean hasInit = initFile.exists();

        try (FileOutputStream fos = new FileOutputStream(tsFile, false);
             FileChannel out = fos.getChannel()) {
            if (hasInit) {
                transferFile(initFile, out);
            }
            for (File seg : segFiles) {
                transferFile(seg, out);
            }
        }

        File outFile = new File(dir, "movie.mp4");
        remuxTsToMp4(tsFile, outFile);

        if (outFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        m.status = "done";
        m.path = outFile.getAbsolutePath();
        m.size = outFile.length();
        m.save(dir);

        deleteIntermediates(dir, null, tsFile);
    }

    private static void handleFmp4VideoOnly(File dir, DownloadManifest m, DownloadEngine.Listener l) throws Exception {
        File initFile = new File(dir, "init.mp4");
        File rawFile = new File(dir, "movie_raw.mp4");
        File outFile = new File(dir, "movie.mp4");
        List<File> segFiles = collectSegments(dir);

        if (!initFile.exists() || initFile.length() <= 0) {
            failInitMissing(dir, m, l);
            return;
        }

        concatenateFiles(initFile, segFiles, rawFile, false);

        if (rawFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        remuxMp4(rawFile, null, outFile, m, l);

        if (!outFile.exists() || outFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        m.status = "done";
        m.path = outFile.getAbsolutePath();
        m.size = outFile.length();
        m.save(dir);

        deleteIntermediates(dir, null, rawFile);
        logOutput(outFile);
    }

    private static void failInitMissing(File dir, DownloadManifest m, DownloadEngine.Listener l) {
        m.status = "failed";
        m.errorCode = "INIT_MISSING";
        m.error = "Init segment missing";
        m.save(dir);
        l.onError(m.id, "INIT_MISSING", "Init segment missing");
    }

    private static String sniffContainer(File dir) {
        File seg = new File(dir, "seg_00000.seg");
        if (!seg.exists()) {
            return null;
        }
        byte[] head = new byte[16];
        int length = 0;
        try (FileInputStream fis = new FileInputStream(seg)) {
            while (length < head.length) {
                int read = fis.read(head, length, head.length - length);
                if (read < 0) {
                    break;
                }
                length += read;
            }
        } catch (Exception ignored) {
            return null;
        }
        if (length >= 8) {
            String tag = new String(head, 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
            if ("styp".equals(tag) || "ftyp".equals(tag) || "moof".equals(tag) || "sidx".equals(tag)) {
                return "fmp4";
            }
        }
        if (length >= 1 && (head[0] & 0xFF) == 0x47) {
            return "ts";
        }
        return null;
    }

    private static List<File> collectSegments(File dir) {
        List<File> segFiles = new ArrayList<>();
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                String name = f.getName();
                if (name.startsWith("seg_") && name.endsWith(".seg")) {
                    segFiles.add(f);
                }
            }
        }
        Collections.sort(segFiles, (a, b) -> a.getName().compareTo(b.getName()));
        return segFiles;
    }

    private static void concatenateFiles(File initFile, List<File> segments, File output, boolean deleteSegments) throws Exception {
        try (FileOutputStream fos = new FileOutputStream(output, false);
             FileChannel out = fos.getChannel()) {
            if (initFile != null && initFile.exists()) {
                transferFile(initFile, out);
            }
            for (File seg : segments) {
                transferFile(seg, out);
                if (deleteSegments) {
                    seg.delete();
                }
            }
        }
    }

    private static void transferFile(File src, FileChannel dst) throws Exception {
        try (FileInputStream fis = new FileInputStream(src);
             FileChannel in = fis.getChannel()) {
            long pos = 0;
            long remaining = in.size();
            while (remaining > 0) {
                long transferred = in.transferTo(pos, remaining, dst);
                pos += transferred;
                remaining -= transferred;
            }
        }
    }

    private static final String REMUX_FAIL_MESSAGE = "Remux failed - tap Retry to remux without re-downloading";

    private static void remuxMp4(File videoFile, File audioFile, File outFile, DownloadManifest m, DownloadEngine.Listener l) throws Exception {
        File tmpFile = new File(outFile.getAbsolutePath() + ".tmp");
        boolean hasAudioFile = audioFile != null && audioFile.exists() && audioFile.length() > 0;

        MediaExtractor vEx = null;
        MediaExtractor aEx = null;
        MediaMuxer muxer = null;
        try {
            try {
                vEx = new MediaExtractor();
                vEx.setDataSource(videoFile.getAbsolutePath());
                int videoTrack = selectTrack(vEx, "video/");
                if (videoTrack < 0) {
                    throw new IllegalStateException("No video track found in video.mp4");
                }
                vEx.selectTrack(videoTrack);
                MediaFormat vFormat = vEx.getTrackFormat(videoTrack);

                int audioTrack = -1;
                MediaFormat aFormat = null;
                if (hasAudioFile) {
                    aEx = new MediaExtractor();
                    aEx.setDataSource(audioFile.getAbsolutePath());
                    audioTrack = selectTrack(aEx, "audio/");
                    if (audioTrack < 0) {
                        throw new IllegalStateException("No audio track found in audio.mp4");
                    }
                    aEx.selectTrack(audioTrack);
                    aFormat = aEx.getTrackFormat(audioTrack);
                }

                Log.d("Downloader", "REMUX video.mp4=" + videoFile.length()
                        + " audio.mp4=" + (hasAudioFile ? audioFile.length() : 0));

                if (tmpFile.exists() && !tmpFile.delete()) {
                    throw new IllegalStateException("Cannot delete stale tmp file");
                }

                muxer = new MediaMuxer(tmpFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                int videoMuxTrack = muxer.addTrack(vFormat);
                int audioMuxTrack = aFormat != null ? muxer.addTrack(aFormat) : -1;
                Log.d("Downloader", "REMUX addTrack video_index=" + videoMuxTrack + " audio_index=" + audioMuxTrack);

                if (vFormat.containsKey(MediaFormat.KEY_ROTATION)) {
                    Integer rotation = vFormat.getInteger(MediaFormat.KEY_ROTATION);
                    if (rotation != null && rotation != 0) {
                        muxer.setOrientationHint(rotation);
                    }
                }
                muxer.start();

                long videoDuration = durationUs(vFormat);
                if (videoDuration <= 0) {
                    videoDuration = durationUs(videoFile);
                }
                long audioDuration = durationUs(aFormat);
                if (audioDuration <= 0 && hasAudioFile) {
                    audioDuration = durationUs(audioFile);
                }
                boolean progressOnVideo = audioDuration <= videoDuration;
                MediaExtractor progressExtractor = progressOnVideo ? vEx : aEx;
                long progressDuration = progressOnVideo ? videoDuration : audioDuration;
                long lastProgressMs = 0;
                int lastPercent = 0;
                if (progressDuration > 0) {
                    emitFinishing(l, m, 0);
                    lastProgressMs = System.currentTimeMillis();
                }

                int bufferSize = Math.max(Math.max(maxInputSize(vFormat), maxInputSize(aFormat)), 2 * 1024 * 1024);
                ByteBuffer buffer = ByteBuffer.allocate(bufferSize);
                MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

                long videoSamples = 0;
                long audioSamples = 0;
                long videoTime = vEx.getSampleTime();
                long audioTime = aEx != null ? aEx.getSampleTime() : -1;

                while (videoTime != -1 || audioTime != -1) {
                    boolean takeVideo = audioTime == -1 || (videoTime != -1 && videoTime <= audioTime);
                    MediaExtractor extractor = takeVideo ? vEx : aEx;
                    int muxTrack = takeVideo ? videoMuxTrack : audioMuxTrack;

                    buffer.clear();
                    int size = extractor.readSampleData(buffer, 0);
                    if (size < 0) {
                        if (takeVideo) {
                            videoTime = -1;
                        } else {
                            audioTime = -1;
                        }
                        continue;
                    }

                    int sampleFlags = extractor.getSampleFlags();
                    bufferInfo.offset = 0;
                    bufferInfo.size = size;
                    bufferInfo.presentationTimeUs = extractor.getSampleTime();
                    bufferInfo.flags = (sampleFlags & MediaExtractor.SAMPLE_FLAG_SYNC) != 0
                            ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
                    muxer.writeSampleData(muxTrack, buffer, bufferInfo);
                    extractor.advance();

                    if (takeVideo) {
                        videoSamples++;
                        videoTime = vEx.getSampleTime();
                    } else {
                        audioSamples++;
                        audioTime = aEx.getSampleTime();
                    }

                    long now = System.currentTimeMillis();
                    if (progressDuration > 0 && now - lastProgressMs >= 1000) {
                        long position = progressExtractor.getSampleTime();
                        if (position < 0) {
                            position = progressDuration;
                        }
                        int percent = (int) Math.min(100, Math.max(0, position * 100 / progressDuration));
                        emitFinishing(l, m, percent);
                        lastPercent = percent;
                        lastProgressMs = now;
                    }
                }

                if (progressDuration > 0 && lastPercent < 100
                        && System.currentTimeMillis() - lastProgressMs >= 1000) {
                    emitFinishing(l, m, 100);
                }

                Log.d("Downloader", "REMUX done video_samples=" + videoSamples + " audio_samples=" + audioSamples);
            } finally {
                if (muxer != null) {
                    try { muxer.stop(); } catch (Exception ignored) {}
                    try { muxer.release(); } catch (Exception ignored) {}
                }
                if (vEx != null) {
                    try { vEx.release(); } catch (Exception ignored) {}
                }
                if (aEx != null) {
                    try { aEx.release(); } catch (Exception ignored) {}
                }
            }

            MediaExtractor checkExtractor = new MediaExtractor();
            boolean hasAudioTrack = false;
            StringBuilder outMimes = new StringBuilder();
            int outTracks;
            try {
                checkExtractor.setDataSource(tmpFile.getAbsolutePath());
                outTracks = checkExtractor.getTrackCount();
                for (int i = 0; i < outTracks; i++) {
                    String mime = checkExtractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
                    if (i > 0) {
                        outMimes.append(",");
                    }
                    outMimes.append(mime);
                    if (mime != null && mime.startsWith("audio/")) {
                        hasAudioTrack = true;
                    }
                }
            } finally {
                checkExtractor.release();
            }
            Log.d("Downloader", "REMUX output tracks=" + outTracks + " mimes=" + outMimes);
            if (hasAudioFile && !hasAudioTrack) {
                Log.d("Downloader", "REMUX audio missing after mux");
                throw new IllegalStateException("Audio missing after mux");
            }

            if (outFile.exists() && !outFile.delete()) {
                throw new IllegalStateException("Cannot replace existing output");
            }
            if (!tmpFile.renameTo(outFile)) {
                throw new IllegalStateException("Failed to move remuxed output into place");
            }
        } catch (Exception e) {
            Log.d("Downloader", "remux error " + e.getClass().getSimpleName() + ": " + e.getMessage());
            if (tmpFile.exists()) {
                tmpFile.delete();
            }
            if (m != null) {
                File dir = outFile.getParentFile();
                m.status = "failed";
                m.errorCode = "MUX_FAILED";
                m.error = REMUX_FAIL_MESSAGE;
                if (dir != null) {
                    m.save(dir);
                }
            }
            throw new IllegalStateException(REMUX_FAIL_MESSAGE, e);
        }
    }

    private static int maxInputSize(MediaFormat format) {
        if (format != null && format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
            Integer value = format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE);
            if (value != null && value > 0) {
                return value;
            }
        }
        return 0;
    }

    private static long durationUs(MediaFormat format) {
        if (format != null && format.containsKey(MediaFormat.KEY_DURATION)) {
            try {
                return format.getLong(MediaFormat.KEY_DURATION);
            } catch (Exception ignored) {}
        }
        return -1;
    }

    private static long durationUs(File file) {
        if (file == null || !file.exists()) {
            return -1;
        }
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(file.getAbsolutePath());
            String value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (value != null) {
                return Long.parseLong(value) * 1000L;
            }
        } catch (Exception ignored) {
        } finally {
            try { retriever.release(); } catch (Exception ignored) {}
        }
        return -1;
    }

    private static void emitFinishing(DownloadEngine.Listener listener, DownloadManifest m, int percent) {
        if (listener == null) {
            return;
        }
        Log.d("Downloader", "Finishing " + percent + "%");
        JSONObject progress = new JSONObject();
        try {
            progress.put("id", m != null && m.id != null ? m.id : "");
            progress.put("percent", percent);
            progress.put("stage", "Finishing");
            progress.put("message", "Finishing " + percent + "%");
            progress.put("bytesDone", 0);
            progress.put("totalBytes", 0);
            progress.put("speedBps", 0);
            progress.put("segDone", 0);
            progress.put("segTotal", 0);
            progress.put("etaSec", 0);
        } catch (JSONException ignored) {}
        try {
            listener.onProgress(progress);
        } catch (Exception ignored) {}
    }

    private static void logOutput(File outFile) {
        String duration = "unknown";
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(outFile.getAbsolutePath());
            String value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (value != null) {
                duration = value;
            }
        } catch (Exception e) {
            Log.d("Downloader", "metadata read failed: " + e.getMessage());
        } finally {
            try { retriever.release(); } catch (Exception ignored) {}
        }
        Log.d("Downloader", "FINALIZE output=" + outFile.getName() + " size=" + outFile.length()
                + " durationMs=" + duration);
    }

    private static int selectTrack(MediaExtractor extractor, String mimePrefix) {
        for (int i = 0; i < extractor.getTrackCount(); i++) {
            MediaFormat format = extractor.getTrackFormat(i);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith(mimePrefix)) {
                return i;
            }
        }
        return -1;
    }

    private static void remuxTsToMp4(File tsFile, File output) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        extractor.setDataSource(tsFile.getAbsolutePath());

        int videoTrack = selectTrack(extractor, "video/");
        int audioTrack = selectTrack(extractor, "audio/");

        if (videoTrack < 0 && audioTrack < 0) {
            extractor.release();
            throw new IllegalStateException("No tracks found in TS file");
        }

        MediaFormat videoFormat = videoTrack >= 0 ? extractor.getTrackFormat(videoTrack) : null;
        MediaFormat audioFormat = audioTrack >= 0 ? extractor.getTrackFormat(audioTrack) : null;

        if (videoTrack >= 0) extractor.selectTrack(videoTrack);
        if (audioTrack >= 0) extractor.selectTrack(audioTrack);

        MediaMuxer muxer = new MediaMuxer(output.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        int muxerVideoTrack = videoFormat != null ? muxer.addTrack(videoFormat) : -1;
        int muxerAudioTrack = audioFormat != null ? muxer.addTrack(audioFormat) : -1;
        muxer.start();

        ByteBuffer buffer = ByteBuffer.allocate(BUFFER_SIZE);
        MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

        while (true) {
            int sampleSize = extractor.readSampleData(buffer, 0);
            if (sampleSize < 0) break;

            long pts = extractor.getSampleTime();
            int flags = extractor.getSampleFlags();

            int trackIndex = extractor.getSampleTrackIndex();
            if (trackIndex == videoTrack && muxerVideoTrack >= 0) {
                bufferInfo.presentationTimeUs = pts;
                bufferInfo.flags = flags;
                bufferInfo.size = sampleSize;
                bufferInfo.offset = 0;
                muxer.writeSampleData(muxerVideoTrack, buffer, bufferInfo);
            } else if (trackIndex == audioTrack && muxerAudioTrack >= 0) {
                bufferInfo.presentationTimeUs = pts;
                bufferInfo.flags = flags;
                bufferInfo.size = sampleSize;
                bufferInfo.offset = 0;
                muxer.writeSampleData(muxerAudioTrack, buffer, bufferInfo);
            }

            extractor.advance();
            buffer.rewind();
        }

        muxer.stop();
        muxer.release();
        extractor.release();
    }

    private static void deleteIntermediates(File videoDir, File audioDir, File... intermediates) {
        for (File f : intermediates) {
            if (f != null && f.exists()) f.delete();
        }

        File[] videoFiles = videoDir.listFiles();
        if (videoFiles != null) {
            for (File f : videoFiles) {
                String name = f.getName();
                if (name.equals("init.mp4") || name.equals("init.bin") || name.startsWith("seg_")) {
                    f.delete();
                }
            }
        }

        if (audioDir != null && audioDir.exists()) {
            File[] audioFiles = audioDir.listFiles();
            if (audioFiles != null) {
                for (File f : audioFiles) {
                    String name = f.getName();
                    if (name.equals("init.mp4") || name.equals("init.bin") || name.startsWith("seg_")) {
                        f.delete();
                    }
                }
            }
            audioDir.delete();
        }
    }
}