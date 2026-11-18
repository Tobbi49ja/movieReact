package com.tobbihub.app;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaMetadataRetriever;
import android.util.Log;

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
        verifySegments(dir, segTotal, "video");
        if (m.hasAudio) {
            verifySegments(new File(dir, "audio"), audioSegTotal, "audio");
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

    private static void handleFmp4WithAudio(File dir, DownloadManifest m, DownloadEngine.Listener l) throws Exception {
        File videoDir = dir;
        File audioDir = new File(dir, "audio");

        File videoInit = new File(videoDir, "init.mp4");
        File audioInit = new File(audioDir, "init.mp4");

        List<File> videoSegs = collectSegments(videoDir);
        List<File> audioSegs = collectSegments(audioDir);

        if (!videoInit.exists() || videoInit.length() <= 0) {
            failInitMissing(dir, m, l);
            return;
        }
        if (!audioInit.exists() || audioInit.length() <= 0) {
            failInitMissing(dir, m, l);
            return;
        }

        File videoMp4 = new File(dir, "video.mp4");
        File audioMp4 = new File(dir, "audio.mp4");

        concatenateFiles(videoInit, videoSegs, videoMp4);
        concatenateFiles(audioInit, audioSegs, audioMp4);

        File outFile = new File(dir, "movie.mp4");
        remuxMp4(videoMp4, audioMp4, outFile);

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

        concatenateFiles(initFile, segFiles, rawFile);

        if (rawFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        remuxMp4(rawFile, null, outFile);

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

    private static void concatenateFiles(File initFile, List<File> segments, File output) throws Exception {
        try (FileOutputStream fos = new FileOutputStream(output, false);
             FileChannel out = fos.getChannel()) {
            if (initFile != null && initFile.exists()) {
                transferFile(initFile, out);
            }
            for (File seg : segments) {
                transferFile(seg, out);
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

    private static void remuxMp4(File videoFile, File audioFile, File outFile) throws Exception {
        MediaExtractor videoExtractor = new MediaExtractor();
        MediaExtractor audioExtractor = null;
        MediaMuxer muxer = null;
        File tmpFile = new File(outFile.getAbsolutePath() + ".tmp");
        try {
            videoExtractor.setDataSource(videoFile.getAbsolutePath());
            int videoTracks = videoExtractor.getTrackCount();
            if (videoTracks <= 0) {
                throw new IllegalStateException("No tracks found in video file");
            }
            boolean hasAudioFile = audioFile != null && audioFile.exists() && audioFile.length() > 0;
            if (hasAudioFile) {
                audioExtractor = new MediaExtractor();
                audioExtractor.setDataSource(audioFile.getAbsolutePath());
            }

            int audioTracks = audioExtractor != null ? audioExtractor.getTrackCount() : 0;
            Log.d("Downloader", "REMUX video.mp4=" + videoFile.length()
                    + " audio.mp4=" + (hasAudioFile ? audioFile.length() : 0));
            Log.d("Downloader", "REMUX video tracks=" + videoTracks + " mimes=" + trackMimes(videoExtractor));
            if (audioExtractor != null) {
                Log.d("Downloader", "REMUX audio tracks=" + audioTracks + " mimes=" + trackMimes(audioExtractor));
            }
            for (int i = 0; i < audioTracks; i++) {
                String mime = audioExtractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
                if (!isMuxerAudioMime(mime)) {
                    Log.d("Downloader", "REMUX unsupported audio mime=" + mime);
                    throw new IllegalStateException("Unsupported audio track mime: " + mime);
                }
            }

            int maxInputSize = 0;
            int rotation = -1;
            for (int i = 0; i < videoTracks; i++) {
                MediaFormat format = videoExtractor.getTrackFormat(i);
                maxInputSize = Math.max(maxInputSize, maxInputSize(format));
                if (rotation < 0 && format.containsKey(MediaFormat.KEY_ROTATION)) {
                    Integer value = format.getInteger(MediaFormat.KEY_ROTATION);
                    if (value != null) {
                        rotation = value;
                    }
                }
            }
            for (int i = 0; i < audioTracks; i++) {
                maxInputSize = Math.max(maxInputSize, maxInputSize(audioExtractor.getTrackFormat(i)));
            }
            if (maxInputSize <= 0) {
                maxInputSize = 2 * 1024 * 1024;
            }

            if (tmpFile.exists() && !tmpFile.delete()) {
                throw new IllegalStateException("Cannot delete stale tmp file");
            }

            muxer = new MediaMuxer(tmpFile.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            if (rotation > 0) {
                muxer.setOrientationHint(rotation);
            }

            int[] videoMuxTracks = new int[videoTracks];
            for (int i = 0; i < videoTracks; i++) {
                videoMuxTracks[i] = muxer.addTrack(videoExtractor.getTrackFormat(i));
                videoExtractor.selectTrack(i);
            }
            int[] audioMuxTracks = new int[audioTracks];
            for (int i = 0; i < audioTracks; i++) {
                audioMuxTracks[i] = muxer.addTrack(audioExtractor.getTrackFormat(i));
                audioExtractor.selectTrack(i);
            }
            muxer.start();

            ByteBuffer buffer = ByteBuffer.allocateDirect(maxInputSize);
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

            long videoTime = videoExtractor.getSampleTime();
            long audioTime = audioExtractor != null ? audioExtractor.getSampleTime() : -1;

            while (videoTime >= 0 || audioTime >= 0) {
                boolean takeVideo = audioTime < 0 || (videoTime >= 0 && videoTime <= audioTime);
                MediaExtractor extractor = takeVideo ? videoExtractor : audioExtractor;
                int[] muxTracks = takeVideo ? videoMuxTracks : audioMuxTracks;

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

                int track = extractor.getSampleTrackIndex();
                bufferInfo.presentationTimeUs = extractor.getSampleTime();
                bufferInfo.flags = extractor.getSampleFlags();
                bufferInfo.offset = 0;
                bufferInfo.size = size;
                if (track >= 0 && track < muxTracks.length) {
                    muxer.writeSampleData(muxTracks[track], buffer, bufferInfo);
                }
                extractor.advance();

                if (takeVideo) {
                    videoTime = videoExtractor.getSampleTime();
                } else {
                    audioTime = audioExtractor.getSampleTime();
                }
            }

            muxer.stop();
            muxer.release();
            muxer = null;

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
                if (tmpFile.exists()) {
                    tmpFile.delete();
                }
                throw new IllegalStateException("Audio missing after mux");
            }

            if (outFile.exists()) {
                outFile.delete();
            }
            if (!tmpFile.renameTo(outFile)) {
                throw new IllegalStateException("Failed to move remuxed output into place");
            }
        } catch (Exception e) {
            Log.d("Downloader", "remux error " + e.getClass().getSimpleName() + ": " + e.getMessage());
            if (muxer != null) {
                try { muxer.stop(); } catch (Exception ignored) {}
                try { muxer.release(); } catch (Exception ignored) {}
            }
            if (tmpFile.exists()) {
                tmpFile.delete();
            }
            throw e;
        } finally {
            videoExtractor.release();
            if (audioExtractor != null) {
                audioExtractor.release();
            }
        }
    }

    private static String trackMimes(MediaExtractor extractor) {
        StringBuilder mimes = new StringBuilder();
        for (int i = 0; i < extractor.getTrackCount(); i++) {
            if (i > 0) {
                mimes.append(",");
            }
            mimes.append(extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME));
        }
        return mimes.toString();
    }

    private static boolean isMuxerAudioMime(String mime) {
        if (mime == null) {
            return false;
        }
        return "audio/mp4a-latm".equalsIgnoreCase(mime)
                || "audio/3gpp".equalsIgnoreCase(mime)
                || "audio/amr-wb".equalsIgnoreCase(mime);
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