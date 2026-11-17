package com.tobbihub.app;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
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

    public static void run(File dir, DownloadManifest m, DownloadEngine.Listener l) {
        try {
            String sniffed = sniffContainer(dir);
            if (sniffed != null) {
                m.container = sniffed;
            }
            if ("fmp4".equals(m.container) && m.hasAudio) {
                handleFmp4WithAudio(dir, m, l);
            } else if ("ts".equals(m.container)) {
                handleTsContainer(dir, m, l);
            } else if ("fmp4".equals(m.container) && !m.hasAudio) {
                handleFmp4VideoOnly(dir, m, l);
            } else {
                l.onError(m.id, "FINALIZE_UNSUPPORTED", "Container not supported: " + m.container);
            }
        } catch (Exception e) {
            m.status = "failed";
            m.errorCode = "MUX_FAILED";
            m.error = e.getMessage();
            m.save(dir);
            l.onError(m.id, "MUX_FAILED", e.getMessage());
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

        File videoMp4 = new File(dir, "video.mp4");
        File audioMp4 = new File(dir, "audio.mp4");

        concatenateFiles(videoInit, videoSegs, videoMp4);
        concatenateFiles(audioInit, audioSegs, audioMp4);

        File outFile = new File(dir, "movie.mp4");
        try {
            muxVideoAudio(videoMp4, audioMp4, outFile);
        } catch (Exception e) {
            Log.d("Downloader", "remux failed, kept fragmented mp4");
            if (outFile.exists()) {
                outFile.delete();
            }
            if (!videoMp4.renameTo(outFile)) {
                throw new IllegalStateException("Output file is empty");
            }
            if (!hasFtyp(outFile)) {
                failInitMissing(dir, m, l);
                return;
            }
        }

        if (!outFile.exists() || outFile.length() <= 0) {
            throw new IllegalStateException("Output file is empty");
        }

        m.status = "done";
        m.path = outFile.getAbsolutePath();
        m.size = outFile.length();
        m.save(dir);

        deleteIntermediates(dir, audioDir, videoMp4, audioMp4);

        l.onComplete(m.id, m.path, m.size);
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

        l.onComplete(m.id, m.path, m.size);
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
            finalizeEmpty(dir, m, l);
            return;
        }

        try {
            remuxTsToMp4(rawFile, outFile);
        } catch (Exception e) {
            Log.d("Downloader", "remux failed, kept fragmented mp4");
            if (outFile.exists()) {
                outFile.delete();
            }
            if (!rawFile.renameTo(outFile)) {
                finalizeEmpty(dir, m, l);
                return;
            }
            if (!hasFtyp(outFile)) {
                failInitMissing(dir, m, l);
                return;
            }
        }

        if (!outFile.exists() || outFile.length() <= 0) {
            finalizeEmpty(dir, m, l);
            return;
        }

        deleteIntermediates(dir, null, rawFile);

        m.status = "done";
        m.path = outFile.getAbsolutePath();
        m.size = outFile.length();
        m.save(dir);
        l.onComplete(m.id, m.path, m.size);
    }

    private static void finalizeEmpty(File dir, DownloadManifest m, DownloadEngine.Listener l) {
        m.status = "failed";
        m.errorCode = "FINALIZE_EMPTY";
        m.error = "Output file is empty";
        m.save(dir);
        l.onError(m.id, "FINALIZE_EMPTY", "Output file is empty");
    }

    private static void failInitMissing(File dir, DownloadManifest m, DownloadEngine.Listener l) {
        m.status = "failed";
        m.errorCode = "INIT_MISSING";
        m.error = "Init segment missing";
        m.save(dir);
        l.onError(m.id, "INIT_MISSING", "Init segment missing");
    }

    private static boolean hasFtyp(File file) {
        if (file == null || !file.exists() || file.length() < 8) {
            return false;
        }
        byte[] head = new byte[8];
        try (FileInputStream fis = new FileInputStream(file)) {
            if (fis.read(head) < 8) {
                return false;
            }
        } catch (Exception ignored) {
            return false;
        }
        return "ftyp".equals(new String(head, 4, 4, java.nio.charset.StandardCharsets.US_ASCII));
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

    private static void muxVideoAudio(File videoFile, File audioFile, File output) throws Exception {
        MediaExtractor videoExtractor = new MediaExtractor();
        videoExtractor.setDataSource(videoFile.getAbsolutePath());
        int videoTrackIndex = selectTrack(videoExtractor, "video/");
        if (videoTrackIndex < 0) {
            videoExtractor.release();
            throw new IllegalStateException("No video track found");
        }
        videoExtractor.selectTrack(videoTrackIndex);
        MediaFormat videoFormat = videoExtractor.getTrackFormat(videoTrackIndex);

        MediaExtractor audioExtractor = new MediaExtractor();
        audioExtractor.setDataSource(audioFile.getAbsolutePath());
        int audioTrackIndex = selectTrack(audioExtractor, "audio/");
        if (audioTrackIndex < 0) {
            audioExtractor.release();
            videoExtractor.release();
            throw new IllegalStateException("No audio track found");
        }
        audioExtractor.selectTrack(audioTrackIndex);
        MediaFormat audioFormat = audioExtractor.getTrackFormat(audioTrackIndex);

        MediaMuxer muxer = new MediaMuxer(output.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        int muxerVideoTrack = muxer.addTrack(videoFormat);
        int muxerAudioTrack = muxer.addTrack(audioFormat);
        muxer.start();

        ByteBuffer buffer = ByteBuffer.allocate(BUFFER_SIZE);
        MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

        boolean videoEos = false;
        boolean audioEos = false;

        int videoSampleSize = videoExtractor.readSampleData(buffer, 0);
        long videoPts = videoSampleSize < 0 ? Long.MAX_VALUE : videoExtractor.getSampleTime();
        int videoFlags = videoSampleSize < 0 ? 0 : videoExtractor.getSampleFlags();

        int audioSampleSize = audioExtractor.readSampleData(buffer, 0);
        long audioPts = audioSampleSize < 0 ? Long.MAX_VALUE : audioExtractor.getSampleTime();
        int audioFlags = audioSampleSize < 0 ? 0 : audioExtractor.getSampleFlags();

        buffer.rewind();

        while (!videoEos || !audioEos) {
            if (videoPts <= audioPts && !videoEos) {
                bufferInfo.presentationTimeUs = videoPts;
                bufferInfo.flags = videoFlags;
                bufferInfo.size = videoSampleSize;
                bufferInfo.offset = 0;
                muxer.writeSampleData(muxerVideoTrack, buffer, bufferInfo);
                videoExtractor.advance();
                videoSampleSize = videoExtractor.readSampleData(buffer, 0);
                if (videoSampleSize < 0) {
                    videoEos = true;
                    videoPts = Long.MAX_VALUE;
                } else {
                    videoPts = videoExtractor.getSampleTime();
                    videoFlags = videoExtractor.getSampleFlags();
                }
            } else if (!audioEos) {
                bufferInfo.presentationTimeUs = audioPts;
                bufferInfo.flags = audioFlags;
                bufferInfo.size = audioSampleSize;
                bufferInfo.offset = 0;
                muxer.writeSampleData(muxerAudioTrack, buffer, bufferInfo);
                audioExtractor.advance();
                audioSampleSize = audioExtractor.readSampleData(buffer, 0);
                if (audioSampleSize < 0) {
                    audioEos = true;
                    audioPts = Long.MAX_VALUE;
                } else {
                    audioPts = audioExtractor.getSampleTime();
                    audioFlags = audioExtractor.getSampleFlags();
                }
            }
            buffer.rewind();
        }

        muxer.stop();
        muxer.release();
        videoExtractor.release();
        audioExtractor.release();
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