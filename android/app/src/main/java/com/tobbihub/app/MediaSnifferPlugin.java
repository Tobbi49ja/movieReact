package com.tobbihub.app;

import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "MediaSniffer")
public class MediaSnifferPlugin extends Plugin {
    private static final String TAG = "MediaSnifferPlugin";
    private static volatile MediaSnifferPlugin instance;
    private final Set<String> foundUrls = Collections.synchronizedSet(new HashSet<String>());
    private volatile boolean enabled = false;

    public MediaSnifferPlugin() {
        instance = this;
    }

    public static MediaSnifferPlugin getInstance() {
        return instance;
    }

    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void start(PluginCall call) {
        enabled = true;
        if (call != null) {
            call.resolve();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        enabled = false;
        if (call != null) {
            call.resolve();
        }
    }

    @PluginMethod
    public void getFound(PluginCall call) {
        JSArray rows = new JSArray();
        synchronized (foundUrls) {
            for (String url : foundUrls) {
                rows.put(createRecord(url));
            }
        }
        if (call != null) {
            JSObject payload = new JSObject();
            payload.put("items", rows);
            call.resolve(payload);
        }
    }

    public void recordFound(String url, Map<String, String> requestHeaders) {
        if (!enabled || url == null || url.trim().isEmpty()) {
            return;
        }

        String candidate = url.trim();
        String lower = candidate.toLowerCase(Locale.US);
        if (candidate.length() < 1024) {
            return;
        }

        String type = null;
        if (lower.contains(".m3u8")) {
            type = "hls";
        } else if (lower.contains(".mp4")) {
            type = "mp4";
        }

        if (type == null) {
            return;
        }

        String host = getHost(candidate);
        if (isTrackingOrAdHost(host)) {
            return;
        }

        if (!foundUrls.add(candidate)) {
            return;
        }

        JSObject payload = new JSObject();
        payload.put("url", candidate);
        payload.put("type", type);

        Map<String, String> filteredHeaders = new LinkedHashMap<>();
        if (requestHeaders != null) {
            String referer = firstHeaderValue(requestHeaders, "Referer");
            String origin = firstHeaderValue(requestHeaders, "Origin");
            String userAgent = firstHeaderValue(requestHeaders, "User-Agent");

            if (referer != null) filteredHeaders.put("Referer", referer);
            if (origin != null) filteredHeaders.put("Origin", origin);
            if (userAgent != null) filteredHeaders.put("User-Agent", userAgent);
        }

        JSObject headerObject = new JSObject();
        for (Map.Entry<String, String> entry : filteredHeaders.entrySet()) {
            headerObject.put(entry.getKey(), entry.getValue());
        }
        payload.put("headers", headerObject);

        Log.d(TAG, "Found media stream: " + candidate);
        notifyListeners("streamFound", payload);
    }

    private static JSObject createRecord(String url) {
        JSObject record = new JSObject();
        String lower = url == null ? "" : url.toLowerCase(Locale.US);
        String type = lower.contains(".m3u8") ? "hls" : (lower.contains(".mp4") ? "mp4" : "unknown");
        record.put("url", url);
        record.put("type", type);
        record.put("headers", new JSObject());
        return record;
    }

    private static String getHost(String url) {
        try {
            Uri parsed = Uri.parse(url);
            return parsed != null ? parsed.getHost() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isTrackingOrAdHost(String host) {
        if (host == null || host.trim().isEmpty()) {
            return false;
        }

        String lower = host.toLowerCase(Locale.US);
        String[] blocked = {
                "doubleclick", "googlesyndication", "google-analytics", "googleadservices",
                "googletagmanager", "ads", "adservice", "adnxs", "analytics", "tracking",
                "metrics", "pixel", "traffic", "click"
        };

        for (String token : blocked) {
            if (lower.contains(token)) {
                return true;
            }
        }

        return false;
    }

    private static String firstHeaderValue(Map<String, String> headers, String key) {
        if (headers == null) {
            return null;
        }

        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }

        return headers.get(key);
    }
}
