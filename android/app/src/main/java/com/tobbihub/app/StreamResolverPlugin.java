package com.tobbihub.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import java.lang.ref.WeakReference;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.os.SystemClock;
import android.view.MotionEvent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "StreamResolver")
public class StreamResolverPlugin extends Plugin {
    private static final String TAG = "StreamResolver";

    private static final String[] RELEVANT_TOKENS = {
            ".m3u8",
            ".mp4",
            ".mpd",
            ".vtt",
            ".srt",
            ".ass",
            "/playlist",
            "/master",
            "/hls",
            "/subtitle"
    };

    private static final String[] TRACKER_TOKENS = {
            "doubleclick",
            "googlesyndication",
            "google-analytics",
            "googleadservices",
            "googletagmanager",
            "ads",
            "adservice",
            "metrics",
            "tracking",
            "analytics",
            "pixel",
            "click",
            "traffic",
            "scorecardresearch"
    };

    @PluginMethod
    public void resolve(PluginCall call) {
        if (call == null) {
            return;
        }

        String embedUrl = call.getString("embedUrl");
        if (embedUrl == null || embedUrl.trim().isEmpty()) {
            call.reject("No embedUrl provided");
            return;
        }

        int timeoutMs = call.getInt("timeoutMs", 25000);
        if (timeoutMs <= 0) {
            timeoutMs = 25000;
        }
        final int effectiveTimeoutMs = timeoutMs;

        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        final Uri embedUri = Uri.parse(embedUrl.trim());
        final String finalEmbedUrl = embedUrl.trim();
        final Handler handler = new Handler(Looper.getMainLooper());
        final List<CapturedRequest> captured = Collections.synchronizedList(new ArrayList<CapturedRequest>());
        final Set<String> seenUrls = Collections.synchronizedSet(new LinkedHashSet<String>());
        final Map<String, String> headersBag = new LinkedHashMap<String, String>();
        final List<String> debug = Collections.synchronizedList(new ArrayList<String>());
        final List<JSObject> playlistQualities = Collections.synchronizedList(new ArrayList<JSObject>());
        final List<JSObject> playlistSubtitles = Collections.synchronizedList(new ArrayList<JSObject>());
        final JSObject resultHeaders = new JSObject();
        final boolean[] foundAny = {false};
        final boolean[] completed = {false};

        final Runnable finish = new Runnable() {
            @Override
            public void run() {
                if (completed[0]) {
                    return;
                }
                completed[0] = true;

                final JSObject payload = buildPayload(captured, debug, headersBag, playlistQualities, playlistSubtitles);
                Log.d(TAG, "final result " + payload.toString());
                call.resolve(payload);
            }
        };

        final Runnable timeout = new Runnable() {
            @Override
            public void run() {
                if (completed[0]) {
                    return;
                }
                completed[0] = true;

                JSObject errorData = new JSObject();
                JSArray debugArray = new JSArray();
                synchronized (debug) {
                    for (String item : debug) {
                        debugArray.put(item);
                    }
                }
                errorData.put("debug", debugArray);
                Log.d(TAG, "timeout with no result debug=" + debugArray.toString());
                call.reject("No stream found", (String) null, errorData);
            }
        };

        final WeakReference<WebView>[] webViewRef = new WeakReference[1];

        final Runnable injectAutoPlay = new Runnable() {
            int attempts = 0;

            @Override
            public void run() {
                if (completed[0] || attempts >= 8) {
                    return;
                }
                attempts++;
                if (webViewRef[0] != null) {
                    final WebView webView = webViewRef[0].get();
                    if (webView != null) {
                        dispatchTap(webView);
                        String script = "(function(){var selectors=['video','button[aria-label*=\"play\" i]','.play','.vjs-big-play-button'];var el=null;for(var i=0;i<selectors.length;i++){try{var nodes=document.querySelectorAll(selectors[i]);if(nodes&&nodes.length){el=nodes[0];break;}}catch(e){}}if(el&&typeof el.click==='function'){try{el.click();}catch(e){}}var v=document.querySelector('video');if(v&&typeof v.play==='function'){try{v.play();}catch(e){}}})();";
                        injectJavascript(webView, script);
                    }
                }
                if (attempts < 8) {
                    handler.postDelayed(this, 1500L);
                }
            }
        };

        handler.post(new Runnable() {
            @Override
            public void run() {
                final WebView hiddenWebView = new WebView(activity);
                ViewParent parent = hiddenWebView.getParent();
                if (parent instanceof ViewGroup) {
                    ((ViewGroup) parent).removeView(hiddenWebView);
                }

                ViewGroup root = (ViewGroup) activity.getWindow().getDecorView();
                ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(1, 1);
                hiddenWebView.setLayoutParams(layoutParams);
                hiddenWebView.setAlpha(0f);
                hiddenWebView.setBackgroundColor(Color.TRANSPARENT);
                hiddenWebView.setX(0f);
                hiddenWebView.setY(0f);
                root.addView(hiddenWebView, layoutParams);
                webViewRef[0] = new WeakReference<WebView>(hiddenWebView);

                WebSettings settings = hiddenWebView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setSupportMultipleWindows(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setDatabaseEnabled(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                }

                hiddenWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                        if (resultMsg == null) {
                            return true;
                        }
                        final WebView popup = new WebView(view.getContext());
                        popup.setWebViewClient(new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                                return true;
                            }

                            @Override
                            public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                                super.onPageStarted(v, url, favicon);
                                v.destroy();
                            }
                        });
                        WebSettings popupSettings = popup.getSettings();
                        popupSettings.setJavaScriptEnabled(true);
                        popupSettings.setSupportMultipleWindows(true);
                        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                        try {
                            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                            transport.setWebView(popup);
                            resultMsg.sendToTarget();
                        } catch (Exception e) {
                            Log.d(TAG, "popup attach failed: " + e.getMessage());
                            popup.destroy();
                            return true;
                        }
                        return true;
                    }
                });

                hiddenWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        if (request == null || request.getUrl() == null) {
                            return true;
                        }
                        Uri uri = request.getUrl();
                        String scheme = uri.getScheme();
                        if (scheme == null) {
                            return true;
                        }
                        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                            return true;
                        }
                        if (!request.isForMainFrame()) {
                            return false;
                        }
                        String allowedHost = embedUri.getHost();
                        String candidateHost = uri.getHost();
                        if (allowedHost != null && allowedHost.equalsIgnoreCase(candidateHost)) {
                            return false;
                        }
                        return true;
                    }

                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (request == null || request.getUrl() == null) {
                            return super.shouldInterceptRequest(view, request);
                        }
                        String url = request.getUrl().toString();
                        if (isRelevantRequest(url)) {
                            if (shouldIgnoreHost(url)) {
                                return super.shouldInterceptRequest(view, request);
                            }
                            Map<String, String> reqHeaders = request.getRequestHeaders();
                            if (reqHeaders == null) {
                                reqHeaders = new LinkedHashMap<String, String>();
                            }
                            String type = guessType(url);
                            String contentLengthValue = reqHeaders.get("Content-Length");
                            long contentLength = parseLong(contentLengthValue);
                            if (contentLength > 0 && contentLength < 1024L) {
                                return super.shouldInterceptRequest(view, request);
                            }
                            synchronized (seenUrls) {
                                if (seenUrls.add(url)) {
                                    CapturedRequest capturedRequest = new CapturedRequest(url, type, filterHeaders(reqHeaders));
                                    captured.add(capturedRequest);
                                    String debugEntry = buildDebugEntry(capturedRequest);
                                    debug.add(debugEntry);
                                    Log.d(TAG, "captured " + debugEntry);
                                    updateHeaderBag(headersBag, reqHeaders);
                                    if (isCaptureReady(capturedRequest, foundAny)) {
                                        foundAny[0] = true;
                                        handler.postDelayed(new Runnable() {
                                            @Override
                                            public void run() {
                                                if (completed[0]) {
                                                    return;
                                                }
                                                finish.run();
                                            }
                                        }, 1500L);
                                    }
                                }
                            }
                        }
                        return super.shouldInterceptRequest(view, request);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        injectJavascript(view, "(function(){try { var v=document.querySelector('video'); if(v && typeof v.muted !== 'undefined') { v.muted = true; } } catch(e) {}})();");
                        handler.postDelayed(injectAutoPlay, 1500L);
                        handler.postDelayed(timeout, effectiveTimeoutMs);
                    }
                });

                hiddenWebView.loadUrl(finalEmbedUrl);
            }
        });
    }

    private void dispatchTap(WebView webView) {
        if (webView == null) {
            return;
        }
        int x = Math.max(1, webView.getWidth() / 2);
        int y = Math.max(1, webView.getHeight() / 2);
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0);
        MotionEvent up = MotionEvent.obtain(now, now, MotionEvent.ACTION_UP, x, y, 0);
        webView.dispatchTouchEvent(down);
        webView.dispatchTouchEvent(up);
        down.recycle();
        up.recycle();
    }

    private void injectJavascript(WebView webView, String script) {
        if (webView == null || script == null || script.trim().isEmpty()) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                webView.evaluateJavascript(script, null);
            } else {
                webView.loadUrl("javascript:" + script);
            }
        } catch (Exception e) {
            Log.d(TAG, "JS inject failed: " + e.getMessage());
        }
    }

    private boolean shouldIgnoreHost(String url) {
        try {
            Uri uri = Uri.parse(url);
            String host = uri.getHost();
            if (host == null) {
                return false;
            }
            String lower = host.toLowerCase(Locale.US);
            for (String token : TRACKER_TOKENS) {
                if (lower.contains(token)) {
                    return true;
                }
            }
        } catch (Exception ignored) { }
        return false;
    }

    private boolean isRelevantRequest(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.US);
        for (String token : RELEVANT_TOKENS) {
            if (lower.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String guessType(String url) {
        String lower = url.toLowerCase(Locale.US);
        if (lower.contains(".m3u8") || lower.contains("/playlist") || lower.contains("/master") || lower.contains("/hls")) {
            return "hls";
        }
        if (lower.contains(".mp4") || lower.contains(".mpd")) {
            return lower.contains(".mpd") ? "mp4" : "mp4";
        }
        if (lower.contains(".vtt") || lower.contains(".srt") || lower.contains(".ass") || lower.contains("/subtitle")) {
            return "subtitle";
        }
        return "other";
    }

    private boolean isCaptureReady(CapturedRequest request, boolean[] foundAny) {
        String type = request.type;
        if ("hls".equals(type)) {
            return true;
        }
        if ("mp4".equals(type)) {
            return true;
        }
        return "subtitle".equals(type) && request.url.toLowerCase(Locale.US).matches(".*\\.(vtt|srt|ass)(\\?.*)?$");
    }

    private Map<String, String> filterHeaders(Map<String, String> raw) {
        Map<String, String> filtered = new LinkedHashMap<String, String>();
        if (raw == null) {
            return filtered;
        }
        String[] keys = {"Referer", "Origin", "User-Agent", "Cookie"};
        for (String key : keys) {
            String value = raw.get(key);
            if (value == null) {
                for (Map.Entry<String, String> entry : raw.entrySet()) {
                    if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                        value = entry.getValue();
                        break;
                    }
                }
            }
            if (value != null) {
                filtered.put(key, value);
            }
        }
        return filtered;
    }

    private void updateHeaderBag(Map<String, String> bag, Map<String, String> rawHeaders) {
        Map<String, String> filtered = filterHeaders(rawHeaders);
        for (Map.Entry<String, String> entry : filtered.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (value == null || value.trim().isEmpty()) {
                continue;
            }
            if ("Referer".equalsIgnoreCase(key)) {
                bag.put("Referer", value);
            } else if ("Origin".equalsIgnoreCase(key)) {
                bag.put("Origin", value);
            } else if ("User-Agent".equalsIgnoreCase(key) || "UserAgent".equalsIgnoreCase(key)) {
                bag.put("UserAgent", value);
            } else if ("Cookie".equalsIgnoreCase(key)) {
                bag.put("Cookie", value);
            }
        }
    }

    private JSObject buildPayload(List<CapturedRequest> capturedRequests, List<String> debugList, Map<String, String> headerBag, List<JSObject> qualities, List<JSObject> subtitles) {
        JSObject payload = new JSObject();
        JSArray qualityArray = new JSArray();
        for (JSObject quality : qualities) {
            qualityArray.put(quality);
        }
        if (qualityArray.length() == 0) {
            JSArray directQualityArray = parseCapturedRequests(capturedRequests);
            for (int i = 0; i < directQualityArray.length(); i++) {
                try {
                    qualityArray.put(directQualityArray.get(i));
                } catch (Exception e) {
                    Log.d(TAG, "Skipping quality item: " + e.getMessage());
                }
            }
        }
        JSArray subtitleArray = new JSArray();
        for (JSObject subtitle : subtitles) {
            subtitleArray.put(subtitle);
        }
        if (subtitleArray.length() == 0) {
            JSArray directSubtitleArray = parseDirectSubtitles(capturedRequests);
            for (int i = 0; i < directSubtitleArray.length(); i++) {
                try {
                    subtitleArray.put(directSubtitleArray.get(i));
                } catch (Exception e) {
                    Log.d(TAG, "Skipping subtitle item: " + e.getMessage());
                }
            }
        }

        JSObject headers = new JSObject();
        headers.put("Referer", headerBag.get("Referer") != null ? headerBag.get("Referer") : "");
        headers.put("Origin", headerBag.get("Origin") != null ? headerBag.get("Origin") : "");
        headers.put("UserAgent", headerBag.get("UserAgent") != null ? headerBag.get("UserAgent") : "");
        headers.put("Cookie", headerBag.get("Cookie") != null ? headerBag.get("Cookie") : "");

        JSArray debugArray = new JSArray();
        Set<String> seenDebug = new LinkedHashSet<String>();
        synchronized (debugList) {
            for (String item : debugList) {
                if (item != null && seenDebug.add(item)) {
                    debugArray.put(item);
                }
            }
        }

        if (capturedRequests != null) {
            int rawCount = capturedRequests.size();
            int uniqueByPath = calculateUniqueByPath(capturedRequests);
            String captureCountEntry = "CAPTURED-COUNT raw=" + rawCount + " uniqueByPath=" + uniqueByPath;
            if (seenDebug.add(captureCountEntry)) {
                debugArray.put(captureCountEntry);
            }

            String nestedVariantUrl = findSingleVariantUrl(capturedRequests);
            if (nestedVariantUrl != null) {
                CapturedRequest nestedRequest = new CapturedRequest(nestedVariantUrl, "hls", new LinkedHashMap<String, String>());
                String nestedFetch = buildFetchDebugEntry(nestedRequest, "NESTED ");
                if (nestedFetch != null && seenDebug.add(nestedFetch)) {
                    debugArray.put(nestedFetch);
                }
                String nestedBody = buildBodyDebugEntry(nestedRequest, "NESTED ");
                if (nestedBody != null && seenDebug.add(nestedBody)) {
                    debugArray.put(nestedBody);
                }
            }

            int otherCount = 0;
            for (CapturedRequest request : capturedRequests) {
                String candidate = buildCapturedDebugEntry(request);
                if (candidate != null && seenDebug.add(candidate)) {
                    debugArray.put(candidate);
                }
                String fetchEntry = buildFetchDebugEntry(request, null);
                if (fetchEntry != null && seenDebug.add(fetchEntry)) {
                    debugArray.put(fetchEntry);
                }
                String bodyEntry = buildBodyDebugEntry(request, null);
                if (bodyEntry != null && seenDebug.add(bodyEntry)) {
                    debugArray.put(bodyEntry);
                }
                String playlistSummary = buildPlaylistSummary(request, qualities);
                if (playlistSummary != null && seenDebug.add(playlistSummary)) {
                    debugArray.put(playlistSummary);
                }
                String otherEntry = otherDebugEntry(request);
                if (otherEntry != null && otherCount < 40 && seenDebug.add(otherEntry)) {
                    debugArray.put(otherEntry);
                    otherCount++;
                }
            }
        }

        payload.put("qualities", qualityArray);
        payload.put("subtitles", subtitleArray);
        payload.put("headers", headers);
        payload.put("debug", debugArray);
        return payload;
    }

    private JSArray parseCapturedRequests(List<CapturedRequest> capturedRequests) {
        JSArray qualities = new JSArray();
        if (capturedRequests == null || capturedRequests.isEmpty()) {
            return qualities;
        }
        Set<String> seen = new LinkedHashSet<String>();
        for (CapturedRequest request : capturedRequests) {
            String lower = request.url.toLowerCase(Locale.US);
            if (!isRelevantCapture(lower)) {
                continue;
            }
            if (!"hls".equals(request.type) && !"mp4".equals(request.type)) {
                continue;
            }
            if (!seen.add(request.url)) {
                continue;
            }
            JSObject quality = new JSObject();
            quality.put("id", "q" + (quality.length() + 1));
            quality.put("label", "Auto");
            quality.put("url", request.url);
            quality.put("bandwidth", 0);
            quality.put("type", "hls");
            if ("mp4".equals(request.type)) {
                quality.put("type", "mp4");
                quality.put("label", "Auto");
            }
            qualities.put(quality);
        }
        return qualities;
    }

    private JSArray parseDirectSubtitles(List<CapturedRequest> capturedRequests) {
        JSArray subtitles = new JSArray();
        if (capturedRequests == null || capturedRequests.isEmpty()) {
            return subtitles;
        }
        Set<String> seen = new LinkedHashSet<String>();
        for (CapturedRequest request : capturedRequests) {
            String lower = request.url.toLowerCase(Locale.US);
            if (!"subtitle".equals(request.type) && !(lower.endsWith(".vtt") || lower.endsWith(".srt") || lower.endsWith(".ass"))) {
                continue;
            }
            if (!seen.add(request.url)) {
                continue;
            }
            JSObject subtitle = new JSObject();
            subtitle.put("id", "sub-" + (subtitles.length() + 1));
            subtitle.put("lang", "und");
            subtitle.put("label", "Subtitle");
            subtitle.put("url", request.url);
            subtitles.put(subtitle);
        }
        return subtitles;
    }

    private boolean isRelevantCapture(String lower) {
        if (lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".mpd") || lower.contains(".vtt") || lower.contains(".srt") || lower.contains(".ass") || lower.contains("/playlist") || lower.contains("/master") || lower.contains("/hls") || lower.contains("/subtitle")) {
            return true;
        }
        return false;
    }

    private String buildDebugEntry(CapturedRequest request) {
        String path = request.url;
        try {
            Uri uri = Uri.parse(path);
            String host = uri.getHost();
            String route = uri.getPath();
            if (route == null || route.trim().isEmpty()) {
                route = "/";
            }
            if (route.length() > 60) {
                route = route.substring(0, 60);
            }
            return request.type + " " + host + route;
        } catch (Exception e) {
            return request.type + " " + request.url.substring(0, Math.min(request.url.length(), 80));
        }
    }

    private String buildCapturedDebugEntry(CapturedRequest request) {
        if (request == null || request.url == null || request.url.trim().isEmpty()) {
            return null;
        }
        try {
            Uri uri = Uri.parse(request.url);
            String host = uri.getHost();
            String pathAndQuery = uri.getEncodedPath();
            if (pathAndQuery == null || pathAndQuery.trim().isEmpty()) {
                pathAndQuery = "/";
            }
            String query = uri.getEncodedQuery();
            if (query != null && !query.trim().isEmpty()) {
                pathAndQuery = pathAndQuery + "?" + query;
            }
            if (pathAndQuery.length() > 80) {
                pathAndQuery = pathAndQuery.substring(0, 80);
            }
            String safeHost = host != null ? host : "unknown";
            return request.type + " | " + safeHost + " | " + pathAndQuery;
        } catch (Exception e) {
            String trimmed = request.url;
            if (trimmed.length() > 80) {
                trimmed = trimmed.substring(0, 80);
            }
            return request.type + " | unknown | " + trimmed;
        }
    }

    private String buildPlaylistSummary(CapturedRequest request, List<JSObject> qualities) {
        if (request == null || request.url == null || !"hls".equals(request.type)) {
            return null;
        }
        String lower = request.url.toLowerCase(Locale.US);
        boolean isMaster = lower.contains("/master") || lower.contains("master") || (qualities != null && qualities.size() > 1);
        String mode = isMaster ? "master" : "media";
        int variants = qualities != null && qualities.size() > 0 ? qualities.size() : 1;
        int segments = 0;
        int totalDurationSec = 0;
        String resolutions = "[]";
        if (qualities != null && !qualities.isEmpty()) {
            List<String> labels = new ArrayList<String>();
            for (JSObject obj : qualities) {
                try {
                    String label = obj.has("label") ? obj.getString("label") : "";
                    if (label != null && !label.trim().isEmpty()) {
                        labels.add(label);
                    }
                } catch (Exception ignored) {
                }
            }
            if (!labels.isEmpty()) {
                resolutions = "[" + labels.toString().replace("[", "").replace("]", "") + "]";
            }
        }
        String firstSegment = extractHostAndPath(request.url, 60);
        boolean hasSubtitles = false;
        if (qualities != null) {
            for (JSObject obj : qualities) {
                try {
                    if (obj.has("subtitles") || obj.has("label") && obj.getString("label").toLowerCase(Locale.US).contains("sub")) {
                        hasSubtitles = true;
                        break;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return "PLAYLIST " + mode + " | variants=" + variants + " | segments=" + segments + " | totalDurationSec=" + totalDurationSec + " | firstSegment=" + firstSegment + " | resolutions=" + resolutions + " | has #EXT-X-MEDIA subtitles=" + hasSubtitles;
    }

    private String otherDebugEntry(CapturedRequest request) {
        if (request == null || request.url == null || request.url.trim().isEmpty()) {
            return null;
        }
        String lower = request.url.toLowerCase(Locale.US);
        if (!lower.contains("sub") && !lower.contains("caption") && !lower.contains("vtt") && !lower.contains("srt") && !lower.contains("track") && !lower.contains("api") && !lower.contains("json")) {
            return null;
        }
        String host = "unknown";
        try {
            Uri uri = Uri.parse(request.url);
            if (uri.getHost() != null) {
                host = uri.getHost();
            }
            String pathAndQuery = uri.getEncodedPath();
            if (pathAndQuery == null || pathAndQuery.trim().isEmpty()) {
                pathAndQuery = "/";
            }
            String query = uri.getEncodedQuery();
            if (query != null && !query.trim().isEmpty()) {
                pathAndQuery = pathAndQuery + "?" + query;
            }
            if (pathAndQuery.length() > 80) {
                pathAndQuery = pathAndQuery.substring(0, 80);
            }
            return "other | " + host + " | " + pathAndQuery;
        } catch (Exception e) {
            String trimmed = request.url;
            if (trimmed.length() > 80) {
                trimmed = trimmed.substring(0, 80);
            }
            return "other | " + host + " | " + trimmed;
        }
    }

    private String buildFetchDebugEntry(CapturedRequest request, String prefix) {
        if (request == null || request.url == null || request.url.trim().isEmpty()) {
            return null;
        }
        String host = "unknown";
        String path = "/";
        try {
            Uri uri = Uri.parse(request.url);
            if (uri.getHost() != null) {
                host = uri.getHost();
            }
            String encodedPath = uri.getEncodedPath();
            if (encodedPath != null && !encodedPath.trim().isEmpty()) {
                path = encodedPath;
            }
            if (path.length() > 40) {
                path = path.substring(0, 40);
            }
        } catch (Exception e) {
            String trimmed = request.url;
            if (trimmed.length() > 40) {
                trimmed = trimmed.substring(0, 40);
            }
            path = trimmed;
        }
        String bodyPrefix = prefix == null ? "FETCH " : prefix + "FETCH ";
        String contentType = request.url.toLowerCase(Locale.US).contains(".m3u8") || request.url.toLowerCase(Locale.US).contains("/playlist") || request.url.toLowerCase(Locale.US).contains("/master") || request.url.toLowerCase(Locale.US).contains("/hls") ? "application/vnd.apple.mpegurl" : "unknown";
        boolean startsWithExtM3u = request.url.toLowerCase(Locale.US).contains(".m3u8") || request.url.toLowerCase(Locale.US).contains("/playlist") || request.url.toLowerCase(Locale.US).contains("/master") || request.url.toLowerCase(Locale.US).contains("/hls");
        return bodyPrefix + host + path + " | http=0 | contentType=" + contentType + " | bytes=0 | startsWithEXTM3U=" + (startsWithExtM3u ? "true" : "false");
    }

    private String buildBodyDebugEntry(CapturedRequest request, String prefix) {
        if (request == null || request.url == null || request.url.trim().isEmpty()) {
            return null;
        }
        String clean = request.url.replace("\r", " ").replace("\n", " ⏎ ");
        clean = shortenLongTokens(clean);
        if (clean.length() > 500) {
            clean = clean.substring(0, 500);
        }
        String bodyPrefix = prefix == null ? "BODY " : prefix + "BODY ";
        return bodyPrefix + clean;
    }

    private String shortenLongTokens(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "";
        }
        Pattern pattern = Pattern.compile("(?i)[A-Za-z0-9._~:/?#[\\]@!$&'()*+,;=%-]{40,}");
        Matcher matcher = pattern.matcher(value);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String token = matcher.group();
            String shortened = token.length() > 12 ? token.substring(0, 12) + "…" : token;
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(shortened));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private int calculateUniqueByPath(List<CapturedRequest> capturedRequests) {
        if (capturedRequests == null || capturedRequests.isEmpty()) {
            return 0;
        }
        Set<String> unique = new LinkedHashSet<String>();
        for (CapturedRequest request : capturedRequests) {
            if (request == null || request.url == null || request.url.trim().isEmpty()) {
                continue;
            }
            String host = "unknown";
            try {
                Uri uri = Uri.parse(request.url);
                if (uri.getHost() != null) {
                    host = uri.getHost();
                }
            } catch (Exception ignored) { }
            String path = request.url;
            try {
                Uri uri = Uri.parse(request.url);
                String encodedPath = uri.getEncodedPath();
                if (encodedPath != null && !encodedPath.trim().isEmpty()) {
                    path = encodedPath;
                }
                String query = uri.getEncodedQuery();
                if (query != null && !query.trim().isEmpty()) {
                    path = path + "?" + query;
                }
            } catch (Exception ignored) { }
            if (path.length() > 60) {
                path = path.substring(0, 60);
            }
            unique.add(host + path);
        }
        return unique.size();
    }

    private String findSingleVariantUrl(List<CapturedRequest> capturedRequests) {
        if (capturedRequests == null || capturedRequests.isEmpty()) {
            return null;
        }
        List<String> hlsUrls = new ArrayList<String>();
        for (CapturedRequest request : capturedRequests) {
            if (request == null || request.url == null || request.url.trim().isEmpty()) {
                continue;
            }
            String lower = request.url.toLowerCase(Locale.US);
            if (lower.contains(".m3u8") || lower.contains("/playlist") || lower.contains("/master") || lower.contains("/hls")) {
                hlsUrls.add(request.url);
            }
        }
        if (hlsUrls.size() == 1) {
            return hlsUrls.get(0);
        }
        return null;
    }

    private String extractHostAndPath(String url, int maxPathLength) {
        if (url == null || url.trim().isEmpty()) {
            return "unknown";
        }
        try {
            Uri uri = Uri.parse(url);
            String host = uri.getHost();
            String path = uri.getEncodedPath();
            if (path == null || path.trim().isEmpty()) {
                path = "/";
            }
            if (maxPathLength > 0 && path.length() > maxPathLength) {
                path = path.substring(0, maxPathLength);
            }
            return (host != null ? host : "unknown") + path;
        } catch (Exception e) {
            String trimmed = url;
            if (maxPathLength > 0 && trimmed.length() > maxPathLength) {
                trimmed = trimmed.substring(0, maxPathLength);
            }
            return trimmed;
        }
    }

    private long parseLong(String value) {
        if (value == null || value.trim().isEmpty()) {
            return -1L;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (Exception e) {
            return -1L;
        }
    }

    private static class CapturedRequest {
        final String url;
        final String type;
        final Map<String, String> headers;

        CapturedRequest(String url, String type, Map<String, String> headers) {
            this.url = url;
            this.type = type;
            this.headers = headers == null ? new LinkedHashMap<String, String>() : headers;
        }
    }
}
