package com.tobbihub.app;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class SubtitleShift {

    private static final String TAG = "SubtitleShift";

    private SubtitleShift() {
    }

    public static File shift(Context context, File source, long offsetMs, boolean vtt) throws IOException {
        if (source == null || !source.isFile()) {
            throw new IOException("Subtitle file not found");
        }
        if (offsetMs == 0) {
            return source;
        }

        File cacheDir = context.getCacheDir();
        if (cacheDir == null) {
            throw new IOException("No cache directory");
        }

        String baseName = safeName(source.getName());
        if (baseName.length() > 64) {
            baseName = baseName.substring(0, 64);
        }
        String unique = Integer.toHexString(source.getAbsolutePath().hashCode());
        File target = new File(cacheDir, "sub-" + unique + "-" + baseName + "-" + offsetMs
                + (vtt ? ".vtt" : ".srt"));

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new FileInputStream(source), StandardCharsets.UTF_8));
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                     new FileOutputStream(target, false), StandardCharsets.UTF_8))) {

            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    first = false;
                    if (line.startsWith("\uFEFF")) {
                        line = line.substring(1);
                    }
                }
                writer.write(shiftLine(line, offsetMs, vtt));
                writer.newLine();
            }
        } catch (IOException e) {
            Log.w(TAG, "shift failed: " + e.getMessage());
            throw e;
        } catch (Exception e) {
            Log.w(TAG, "shift failed: " + e.getMessage());
            throw new IOException("Cannot shift subtitles", e);
        }

        return target;
    }

    static String shiftLine(String line, long offsetMs, boolean vtt) {
        if (line == null) {
            return "";
        }
        int arrow = line.indexOf("-->");
        if (arrow < 0) {
            return line;
        }

        String startToken = line.substring(0, arrow).trim();
        String rest = line.substring(arrow + 3).trim();
        int split = firstWhitespace(rest);
        String endToken = split < 0 ? rest : rest.substring(0, split);
        String suffix = split < 0 ? "" : rest.substring(split);

        long start = parseTimestamp(startToken);
        long end = parseTimestamp(endToken);
        if (start < 0 || end < 0) {
            return line;
        }

        long newStart = Math.max(0, start + offsetMs);
        long newEnd = Math.max(newStart, Math.max(0, end + offsetMs));
        return formatTimestamp(newStart, vtt) + " --> " + formatTimestamp(newEnd, vtt) + suffix;
    }

    private static int firstWhitespace(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isWhitespace(value.charAt(i))) {
                return i;
            }
        }
        return -1;
    }

    static long parseTimestamp(String token) {
        if (token == null) {
            return -1;
        }
        token = token.trim();
        if (token.isEmpty()) {
            return -1;
        }

        int separator = Math.max(token.lastIndexOf(','), token.lastIndexOf('.'));
        if (separator <= 0 || separator >= token.length() - 1) {
            return -1;
        }

        String main = token.substring(0, separator);
        String millisecondsPart = token.substring(separator + 1);
        if (!millisecondsPart.matches("\\d{1,3}")) {
            return -1;
        }
        int milliseconds = Integer.parseInt(millisecondsPart);
        if (millisecondsPart.length() == 1) {
            milliseconds *= 100;
        } else if (millisecondsPart.length() == 2) {
            milliseconds *= 10;
        }

        String[] parts = main.split(":");
        long totalSeconds;
        if (parts.length == 3) {
            if (parts[0].length() > 3 || parts[1].length() > 2 || parts[2].length() > 2) {
                return -1;
            }
            long hours = parseNumber(parts[0]);
            long minutes = parseNumber(parts[1]);
            long seconds = parseNumber(parts[2]);
            if (hours < 0 || minutes < 0 || seconds < 0 || minutes > 59 || seconds > 59) {
                return -1;
            }
            totalSeconds = hours * 3600 + minutes * 60 + seconds;
        } else if (parts.length == 2) {
            if (parts[0].length() > 3 || parts[1].length() > 2) {
                return -1;
            }
            long minutes = parseNumber(parts[0]);
            long seconds = parseNumber(parts[1]);
            if (minutes < 0 || seconds < 0 || seconds > 59) {
                return -1;
            }
            totalSeconds = minutes * 60 + seconds;
        } else {
            return -1;
        }

        return totalSeconds * 1000 + milliseconds;
    }

    private static long parseNumber(String value) {
        if (value == null || value.isEmpty()) {
            return -1;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return -1;
            }
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    static String formatTimestamp(long millis, boolean vtt) {
        long value = Math.max(0, millis);
        long hours = value / 3_600_000L;
        value %= 3_600_000L;
        long minutes = value / 60_000L;
        value %= 60_000L;
        long seconds = value / 1_000L;
        long milliseconds = value % 1_000L;

        return String.format(
                Locale.US,
                "%02d:%02d:%02d%s%03d",
                hours,
                minutes,
                seconds,
                vtt ? "." : ",",
                milliseconds
        );
    }

    private static String safeName(String name) {
        if (name == null || name.isEmpty()) {
            return "subtitle";
        }
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
