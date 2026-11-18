package com.tobbihub.app;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class HttpUtil {

    private static final int SEGMENT_DEADLINE_MS = 40000;
    private static final Set<HttpURLConnection> ACTIVE_CONNECTIONS =
            Collections.newSetFromMap(new ConcurrentHashMap<HttpURLConnection, Boolean>());
    private static final ScheduledExecutorService DEADLINE_EXECUTOR =
            Executors.newScheduledThreadPool(2, r -> {
                Thread t = new Thread(r, "HttpDeadline");
                t.setDaemon(true);
                return t;
            });

    public static void disconnectAll() {
        for (HttpURLConnection connection : ACTIVE_CONNECTIONS) {
            try { connection.disconnect(); } catch (Exception ignored) {}
        }
    }

    public static class PausedException extends IOException {
        public PausedException() { super("Download paused"); }
    }

    public static class Result {
        public int code;
        public String body;
        public String error;
        public String finalUrl;
    }

    public static Map<String, String> buildHeaders(String ua, String referer, String origin, String cookie) {
        Map<String, String> headers = new HashMap<>();
        if (ua != null && !ua.isEmpty()) {
            headers.put("User-Agent", ua);
        }
        if (referer != null && !referer.isEmpty()) {
            headers.put("Referer", referer);
        }
        String originValue = origin;
        if ((originValue == null || originValue.isEmpty()) && referer != null && !referer.isEmpty()) {
            try {
                URL refUrl = new URL(referer);
                originValue = refUrl.getProtocol() + "://" + refUrl.getHost();
            } catch (Exception ignored) {}
        }
        if (originValue != null && !originValue.isEmpty()) {
            headers.put("Origin", originValue);
        }
        if (cookie != null && !cookie.isEmpty()) {
            headers.put("Cookie", cookie);
        }
        headers.put("Accept", "*/*");
        headers.put("Accept-Language", "en-US,en;q=0.9");
        headers.put("Accept-Encoding", "identity");
        return headers;
    }

    public static Result fetchText(String url, Map<String, String> headers) {
        Result result = new Result();
        int redirects = 0;
        URL currentUrl;
        try {
            currentUrl = new URL(url);
        } catch (Exception e) {
            result.code = 0;
            result.error = e.getMessage();
            return result;
        }

        while (redirects <= 5) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) currentUrl.openConnection();
                ACTIVE_CONNECTIONS.add(connection);
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(20000);
                connection.setRequestMethod("GET");

                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }

                result.code = connection.getResponseCode();
                String location = connection.getHeaderField("Location");
                result.finalUrl = currentUrl.toString();

                if ((result.code == 301 || result.code == 302 || result.code == 303 || result.code == 307 || result.code == 308) && location != null && redirects < 5) {
                    try {
                        currentUrl = new URL(currentUrl, location);
                    } catch (Exception e) {
                        result.error = "Invalid redirect URL: " + location;
                        return result;
                    }
                    redirects++;
                    continue;
                }

                InputStream inputStream;
                if (result.code >= 400) {
                    inputStream = connection.getErrorStream();
                } else {
                    inputStream = connection.getInputStream();
                }

                if (inputStream != null) {
                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line).append('\n');
                        }
                    }
                    result.body = sb.toString();
                } else {
                    result.body = "";
                }

                return result;

            } catch (IOException e) {
                result.code = 0;
                result.error = e.getMessage();
                return result;
            } finally {
                if (connection != null) {
                    ACTIVE_CONNECTIONS.remove(connection);
                    connection.disconnect();
                }
            }
        }

        result.code = 0;
        result.error = "Too many redirects";
        return result;
    }

    public static int downloadToFile(String url, Map<String, String> headers, File dest, AtomicBoolean cancel, AtomicBoolean pause, AtomicLong bytes) throws IOException {
        int redirects = 0;
        URL currentUrl;
        try {
            currentUrl = new URL(url);
        } catch (Exception e) {
            throw new IOException("Invalid URL: " + url, e);
        }

        FileOutputStream fos = null;
        long deadline = System.currentTimeMillis() + SEGMENT_DEADLINE_MS;
        try {
            while (redirects <= 5) {
                HttpURLConnection connection = null;
                ScheduledFuture<?> deadlineTask = null;
                try {
                    connection = (HttpURLConnection) currentUrl.openConnection();
                    ACTIVE_CONNECTIONS.add(connection);
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(10000);
                    long remaining = Math.max(1, deadline - System.currentTimeMillis());
                    connection.setReadTimeout((int) Math.min(15000, remaining));
                    connection.setRequestMethod("GET");

                    for (Map.Entry<String, String> header : headers.entrySet()) {
                        connection.setRequestProperty(header.getKey(), header.getValue());
                    }

                    final HttpURLConnection deadlineConnection = connection;
                    deadlineTask = DEADLINE_EXECUTOR.schedule(() -> {
                        try { deadlineConnection.disconnect(); } catch (Exception ignored) {}
                    }, remaining, TimeUnit.MILLISECONDS);

                    int code = connection.getResponseCode();
                    String location = connection.getHeaderField("Location");

                    if ((code == 301 || code == 302 || code == 303 || code == 307 || code == 308) && location != null && redirects < 5) {
                        try {
                            currentUrl = new URL(currentUrl, location);
                        } catch (Exception e) {
                            throw new IOException("Invalid redirect URL: " + location, e);
                        }
                        redirects++;
                        continue;
                    }

                    if (fos == null) {
                        fos = new FileOutputStream(dest);
                    }

                    InputStream inputStream;
                    if (code >= 400) {
                        inputStream = connection.getErrorStream();
                        if (inputStream == null) {
                            throw new IOException("HTTP error " + code);
                        }
                    } else {
                        inputStream = connection.getInputStream();
                    }

                    byte[] buffer = new byte[8192];
                    int len;
                    while (true) {
                        if (System.currentTimeMillis() > deadline) {
                            throw new IOException("Segment deadline exceeded");
                        }
                        try {
                            len = inputStream.read(buffer);
                        } catch (IOException readError) {
                            if (pause != null && pause.get()) {
                                throw new PausedException();
                            }
                            if (cancel != null && cancel.get()) {
                                throw new IOException("Download cancelled");
                            }
                            throw readError;
                        }
                        if (len == -1) {
                            break;
                        }
                        if (cancel != null && cancel.get()) {
                            throw new IOException("Download cancelled");
                        }
                        if (pause != null && pause.get()) {
                            throw new PausedException();
                        }
                        fos.write(buffer, 0, len);
                        if (bytes != null) {
                            bytes.addAndGet(len);
                        }
                    }

                    fos.flush();
                    return code;

                } finally {
                    if (deadlineTask != null) {
                        deadlineTask.cancel(false);
                    }
                    if (connection != null) {
                        ACTIVE_CONNECTIONS.remove(connection);
                        connection.disconnect();
                    }
                }
            }
            throw new IOException("Too many redirects");
        } catch (PausedException pe) {
            if (dest != null) dest.delete();
            throw pe;
        } catch (IOException e) {
            if (pause != null && pause.get()) {
                if (dest != null) dest.delete();
                throw new PausedException();
            }
            throw e;
        } finally {
            if (fos != null) {
                try {
                    fos.close();
                } catch (IOException ignored) {}
            }
        }
    }
}