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
import android.webkit.CookieManager;
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

import org.json.JSONTokener;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "StreamResolver")
public class StreamResolverPlugin extends Plugin {
    private static final String TAG = "StreamResolver";
    private static final Pattern LONG_TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9_\\-.~%]{40,}");

    private static final String[] RELEVANT_TOKENS = {
            ".m3u8",
            ".mp4",
            ".vtt",
            ".srt",
            ".ass",
            "/subtitle"
    };

    private static final String[] IGNORED_PATH_SUFFIXES = {
            ".js", ".css", ".html", ".json", ".png", ".jpg", ".svg", ".woff", ".woff2", ".ico"
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
        final boolean[] foundAny = {false};
        final boolean[] completed = {false};
        final boolean[] fetchStarted = {false};
        final boolean[] fetchInProgress = {false};
        final String[] webViewUserAgent = {""};
        final WeakReference<WebView>[] webViewRef = new WeakReference[1];
        final boolean[] webViewFetchPending = {false};
        final CapturedRequest[] webViewFetchRequest = {null};
        final FetchResult[] webViewNativeResult = {null};
        final Runnable[] webViewFetchTimeout = {null};
        final String[] resolvedMasterUrl = {null};

        final Runnable completeResolve = new Runnable() {
            @Override
            public void run() {
                if (completed[0]) {
                    return;
                }
                completed[0] = true;
                final JSObject payload = buildPayload(captured, debug, headersBag, playlistQualities, playlistSubtitles,
                        resolvedMasterUrl[0]);
                Log.d(TAG, "final result built");
                call.resolve(payload);
            }
        };

        final Runnable finish = new Runnable() {
            @Override
            public void run() {
                if (completed[0] || fetchInProgress[0]) {
                    return;
                }
                CapturedRequest playlistRequest = null;
                final List<CapturedRequest> mp4Requests = new ArrayList<CapturedRequest>();
                synchronized (captured) {
                    for (CapturedRequest request : captured) {
                        if ("hls".equals(request.type)) {
                            playlistRequest = request;
                        } else if ("mp4".equals(request.type) && isMp4Url(request.url)) {
                            mp4Requests.add(request);
                        }
                    }
                }
                if (playlistRequest == null && mp4Requests.isEmpty()) {
                    completeResolve.run();
                    return;
                }
                if (fetchStarted[0]) {
                    return;
                }
                fetchStarted[0] = true;
                fetchInProgress[0] = true;
                final CapturedRequest requestToFetch = playlistRequest;
                final String capturedReferer;
                synchronized (headersBag) {
                    capturedReferer = headersBag.get("Referer");
                }
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        if (requestToFetch == null) {
                            CapturedRequest validMp4 = null;
                            for (CapturedRequest mp4Request : mp4Requests) {
                                MediaCheck check = validateMp4(mp4Request, webViewUserAgent[0], capturedReferer);
                                if (check.valid) {
                                    validMp4 = mp4Request;
                                    break;
                                }
                            }
                            final CapturedRequest checkedMp4 = validMp4;
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    if (checkedMp4 != null) {
                                        addMp4Quality(checkedMp4, playlistQualities);
                                    }
                                    fetchInProgress[0] = false;
                                    completeResolve.run();
                                }
                            });
                            return;
                        }
                        final FetchResult result = fetchPlaylist(
                                requestToFetch,
                                webViewUserAgent[0],
                                capturedReferer);
                        requestToFetch.fetchResult = result;
                        String fetchEntry = buildFetchDebugEntry(requestToFetch, result, null);
                        String bodyEntry = buildBodyDebugEntry(result, null);
                        synchronized (debug) {
                            debug.add(fetchEntry);
                            debug.add(bodyEntry);
                        }
                        logDebugEntry(fetchEntry);
                        logDebugEntry(bodyEntry);
                        if (result.code != 200 || !result.startsWithExtM3u) {
                            logFetchFailureDiagnostics(result, debug);
                        }
                        if (result.code >= 400 && result.code < 500) {
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    startWebViewPlaylistRetry(requestToFetch, result, capturedReferer,
                                            webViewRef, webViewFetchPending, webViewFetchRequest,
                                            webViewNativeResult, webViewFetchTimeout, handler, debug,
                                            completed, call);
                                }
                            });
                            return;
                        }
                        if (result.code != 200 || !result.startsWithExtM3u) {
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    rejectPlaylistFetch(call, result, debug, completed);
                                }
                            });
                            return;
                        }
                        resolvedMasterUrl[0] = requestToFetch.url;
                        processPlaylistBody(requestToFetch, result.body, playlistQualities, debug,
                                webViewUserAgent[0], capturedReferer, captured);
                        handler.post(new Runnable() {
                            @Override
                            public void run() {
                                fetchInProgress[0] = false;
                                completeResolve.run();
                            }
                        });
                    }
                }, "StreamResolverPlaylistFetch").start();
            }
        };

        final Runnable timeout = new Runnable() {
            @Override
            public void run() {
                if (completed[0] || fetchInProgress[0]) {
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
                Log.d(TAG, "timeout with no result");
                call.reject("No stream found", (String) null, errorData);
            }
        };

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
                webViewUserAgent[0] = settings.getUserAgentString();
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
                        if (webViewFetchPending[0]) {
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
                            synchronized (seenUrls) {
                                if (seenUrls.add(url)) {
                                    CapturedRequest capturedRequest = new CapturedRequest(
                                            url, type, new LinkedHashMap<String, String>(reqHeaders));
                                    captured.add(capturedRequest);
                                    String debugEntry = buildDebugEntry(capturedRequest);
                                    debug.add(debugEntry);
                                    logDebugEntry("captured " + debugEntry);
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
                        if (webViewFetchPending[0] && webViewFetchRequest[0] != null) {
                            view.evaluateJavascript("(function(){return document.body?document.body.innerText:''})()", value -> {
                                if (!webViewFetchPending[0]) {
                                    return;
                                }
                                String body = decodeJavascriptString(value);
                                boolean validPlaylist = body.startsWith("#EXTM3U");
                                webViewFetchPending[0] = false;
                                if (webViewFetchTimeout[0] != null) {
                                    handler.removeCallbacks(webViewFetchTimeout[0]);
                                }
                                logAndAddDebug(debug, "WEBVIEW-FETCH " + (validPlaylist ? "ok" : "failed")
                                        + " | bytes=" + body.getBytes(StandardCharsets.UTF_8).length);
                                if (validPlaylist) {
                                    CapturedRequest fetchedRequest = webViewFetchRequest[0];
                                    fetchedRequest.fetchResult = webViewNativeResult[0].withBody(body);
                                    logAndAddDebug(debug, buildBodyDebugEntry(fetchedRequest.fetchResult, "WEBVIEW-"));
                                    new Thread(() -> {
                                        resolvedMasterUrl[0] = fetchedRequest.url;
                                        processPlaylistBody(fetchedRequest, body, playlistQualities, debug,
                                                webViewUserAgent[0], headersBag.get("Referer"), captured);
                                        handler.post(() -> {
                                            fetchInProgress[0] = false;
                                            completeResolve.run();
                                        });
                                    }, "StreamResolverWebViewPlaylist").start();
                                } else {
                                    String visibleText = body.replaceAll("\\s+", " ").trim();
                                    if (visibleText.length() > 300) {
                                        visibleText = visibleText.substring(0, 300);
                                    }
                                    logAndAddDebug(debug, "BLOCKTEXT "
                                            + (visibleText.isEmpty() ? "no body" : visibleText));
                                    rejectPlaylistFetch(call, webViewNativeResult[0], debug, completed);
                                }
                            });
                            return;
                        }
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
        Uri uri = Uri.parse(url);
        String path = uri.getPath();
        if (path == null) {
            return false;
        }
        String lower = path.toLowerCase(Locale.US);
        for (String suffix : IGNORED_PATH_SUFFIXES) {
            if (lower.endsWith(suffix)) {
                return false;
            }
        }
        for (String token : RELEVANT_TOKENS) {
            if (lower.endsWith(token) || "/subtitle".equals(token) && lower.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String guessType(String url) {
        String path = Uri.parse(url).getPath();
        String lower = path == null ? "" : path.toLowerCase(Locale.US);
        if (lower.endsWith(".m3u8")) {
            return "hls";
        }
        if (lower.endsWith(".mp4")) {
            return "mp4";
        }
        if (lower.endsWith(".vtt") || lower.endsWith(".srt") || lower.endsWith(".ass") || lower.contains("/subtitle")) {
            return "subtitle";
        }
        return "other";
    }

    private boolean isCaptureReady(CapturedRequest request, boolean[] foundAny) {
        String type = request.type;
        if ("hls".equals(type) || "mp4".equals(type)) {
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
        synchronized (bag) {
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
    }

    private JSObject buildPayload(List<CapturedRequest> capturedRequests, List<String> debugList,
                                  Map<String, String> headerBag, List<JSObject> qualities,
                                  List<JSObject> subtitles, String masterUrl) {
        JSObject payload = new JSObject();
        JSArray qualityArray = new JSArray();
        for (JSObject quality : qualities) {
            qualityArray.put(quality);
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
        try {
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
                    logDebugEntry(captureCountEntry);
                }

                int otherCount = 0;
                for (CapturedRequest request : capturedRequests) {
                    String candidate = buildCapturedDebugEntry(request);
                    if (candidate != null && seenDebug.add(candidate)) {
                        debugArray.put(candidate);
                        logDebugEntry(candidate);
                    }
                    String otherEntry = otherDebugEntry(request);
                    if (otherEntry != null && otherCount < 40 && seenDebug.add(otherEntry)) {
                        debugArray.put(otherEntry);
                        logDebugEntry(otherEntry);
                        otherCount++;
                    }
                }
            }
        } catch (Throwable error) {
            String diagnosticError = "DIAG-ERROR " + error.getClass().getName() + ": " + String.valueOf(error.getMessage());
            try {
                debugArray.put(diagnosticError);
                logDebugEntry(diagnosticError);
            } catch (Throwable ignored) {
            }
        }

        payload.put("masterUrl", masterUrl == null ? JSONObject.NULL : masterUrl);
        payload.put("qualities", qualityArray);
        payload.put("subtitles", subtitleArray);
        payload.put("headers", headers);
        payload.put("debug", debugArray);
        return payload;
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

    private boolean isMp4Url(String url) {
        String path = Uri.parse(url).getPath();
        return path != null && path.toLowerCase(Locale.US).endsWith(".mp4");
    }

    private FetchResult fetchPlaylist(CapturedRequest request, String userAgent, String headerReferer) {
        int code = 0;
        String contentType = null;
        String body = "";
        int byteLength = 0;
        String error = null;
        URL currentUrl = null;
        HttpURLConnection connection = null;
        Map<String, String> headers = buildFetchHeaders(request, userAgent, headerReferer);
        String capturedCookie = getHeader(request.headers, "Cookie");
        List<String> sentHeaderNames = new ArrayList<String>();
        String sentCookie = null;
        String server = null;
        String cfRay = null;
        String location = null;
        String setCookieNames = "";
        try {
            currentUrl = new URL(request.url);
            int redirects = 0;
            while (true) {
                connection = (HttpURLConnection) currentUrl.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                sentHeaderNames.clear();
                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                    sentHeaderNames.add(header.getKey());
                }
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.flush();
                String webViewCookie = cookieManager.getCookie(currentUrl.toString());
                sentCookie = joinCookies(capturedCookie, webViewCookie);
                if (sentCookie != null) {
                    connection.setRequestProperty("Cookie", sentCookie);
                    sentHeaderNames.add("Cookie");
                }

                code = connection.getResponseCode();
                contentType = connection.getHeaderField("Content-Type");
                server = connection.getHeaderField("Server");
                cfRay = connection.getHeaderField("cf-ray");
                location = connection.getHeaderField("Location");
                setCookieNames = getSetCookieNames(connection);
                InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                byte[] responseBytes = readFully(stream);
                String responseBody = new String(responseBytes, StandardCharsets.UTF_8);
                if (isRedirect(code) && location != null && redirects < 5) {
                    currentUrl = new URL(currentUrl, location);
                    redirects++;
                    connection.disconnect();
                    connection = null;
                    continue;
                }
                body = responseBody;
                byteLength = responseBytes.length;
                break;
            }
        } catch (Exception exception) {
            error = exception.getClass().getName() + ": " + String.valueOf(exception.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        boolean startsWithExtM3u = body.startsWith("#EXTM3U");
        String finalHost = currentUrl != null && currentUrl.getHost() != null
                ? currentUrl.getHost()
                : "unknown";
        String responseHeaders = "RESPHEADERS server=" + valueOrNone(server)
                + " | cf-ray=" + valueOrNone(cfRay)
                + " | content-type=" + valueOrNone(contentType)
                + " | location=" + valueOrNone(location)
                + " | set-cookie=" + (setCookieNames.isEmpty() ? "none" : setCookieNames);
        return new FetchResult(code, contentType, body, byteLength, startsWithExtM3u, finalHost,
                error, sentHeaderNames, sentCookie != null, sentCookie == null ? 0 : sentCookie.length(),
                responseHeaders);
    }

    private Map<String, String> buildFetchHeaders(CapturedRequest request, String userAgent, String fallbackReferer) {
        Map<String, String> headers = new LinkedHashMap<String, String>();
        for (Map.Entry<String, String> entry : request.headers.entrySet()) {
            String name = entry.getKey();
            if (name == null || name.trim().isEmpty() || "Cookie".equalsIgnoreCase(name)
                    || isRestrictedRequestHeader(name)) {
                continue;
            }
            headers.put(name, entry.getValue() == null ? "" : entry.getValue());
        }
        putHeaderIfMissing(headers, "User-Agent",
                firstNonEmpty(userAgent, WebSettings.getDefaultUserAgent(getContext())));
        putHeaderIfMissing(headers, "Referer", fallbackReferer);
        if (getHeader(request.headers, "Origin") == null) {
            putHeaderIfMissing(headers, "Origin", originFromReferer(getHeader(headers, "Referer")));
        }
        putHeaderIfMissing(headers, "Accept", "*/*");
        putHeaderIfMissing(headers, "Accept-Language", "en-US,en;q=0.9");
        setHeader(headers, "Sec-Fetch-Dest", "empty");
        setHeader(headers, "Sec-Fetch-Mode", "cors");
        setHeader(headers, "Sec-Fetch-Site", "cross-site");
        setHeader(headers, "Accept-Encoding", "identity");
        return headers;
    }

    private boolean isRestrictedRequestHeader(String name) {
        return "Host".equalsIgnoreCase(name)
                || "Connection".equalsIgnoreCase(name)
                || "Content-Length".equalsIgnoreCase(name)
                || "Transfer-Encoding".equalsIgnoreCase(name)
                || "Proxy-Connection".equalsIgnoreCase(name);
    }

    private void putHeaderIfMissing(Map<String, String> headers, String name, String value) {
        if (value != null && getHeader(headers, name) == null) {
            headers.put(name, value);
        }
    }

    private void setHeader(Map<String, String> headers, String name, String value) {
        String existing = null;
        for (String key : headers.keySet()) {
            if (key.equalsIgnoreCase(name)) {
                existing = key;
                break;
            }
        }
        if (existing != null) {
            headers.remove(existing);
        }
        headers.put(name, value);
    }

    private String joinCookies(String capturedCookie, String webViewCookie) {
        boolean hasCaptured = capturedCookie != null && !capturedCookie.trim().isEmpty();
        boolean hasWebView = webViewCookie != null;
        if (hasCaptured && hasWebView && !webViewCookie.trim().isEmpty()) {
            return capturedCookie + "; " + webViewCookie;
        }
        if (hasCaptured) {
            return capturedCookie;
        }
        return hasWebView ? webViewCookie : null;
    }

    private String getSetCookieNames(HttpURLConnection connection) {
        List<String> names = new ArrayList<String>();
        Map<String, List<String>> headers = connection.getHeaderFields();
        if (headers == null) {
            return "";
        }
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            if (entry.getKey() == null || !"Set-Cookie".equalsIgnoreCase(entry.getKey()) || entry.getValue() == null) {
                continue;
            }
            for (String cookie : entry.getValue()) {
                int equals = cookie == null ? -1 : cookie.indexOf('=');
                if (equals > 0) {
                    names.add(cookie.substring(0, equals).trim());
                }
            }
        }
        return names.toString();
    }

    private String valueOrNone(String value) {
        return value == null || value.trim().isEmpty() ? "none" : value;
    }

    private MediaCheck validateMp4(CapturedRequest request, String userAgent, String referer) {
        MediaCheck headCheck = probeMp4(request, userAgent, referer, "HEAD");
        if (headCheck.valid) {
            return headCheck;
        }
        return probeMp4(request, userAgent, referer, "GET");
    }

    private MediaCheck probeMp4(CapturedRequest request, String userAgent, String referer, String method) {
        HttpURLConnection connection = null;
        int code = 0;
        String contentType = null;
        try {
            URL currentUrl = new URL(request.url);
            Map<String, String> headers = buildFetchHeaders(request, userAgent, referer);
            int redirects = 0;
            while (true) {
                connection = (HttpURLConnection) currentUrl.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                connection.setRequestMethod(method);
                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
                if ("GET".equals(method)) {
                    connection.setRequestProperty("Range", "bytes=0-0");
                }
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.flush();
                String cookie = joinCookies(getHeader(request.headers, "Cookie"),
                        cookieManager.getCookie(currentUrl.toString()));
                if (cookie != null) {
                    connection.setRequestProperty("Cookie", cookie);
                }
                code = connection.getResponseCode();
                contentType = connection.getHeaderField("Content-Type");
                String location = connection.getHeaderField("Location");
                if (isRedirect(code) && location != null && redirects < 5) {
                    currentUrl = new URL(currentUrl, location);
                    redirects++;
                    connection.disconnect();
                    connection = null;
                    continue;
                }
                if (code >= 400) {
                    closeQuietly(connection.getErrorStream());
                } else if ("GET".equals(method)) {
                    closeQuietly(connection.getInputStream());
                }
                break;
            }
        } catch (Exception exception) {
            logDebugEntry("MP4 " + method + " probe failed: " + exception.getClass().getName()
                    + ": " + String.valueOf(exception.getMessage()));
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        String normalizedType = contentType == null ? "" : contentType.toLowerCase(Locale.US).split(";", 2)[0].trim();
        boolean acceptedType = normalizedType.startsWith("video/")
                || "application/octet-stream".equals(normalizedType);
        return new MediaCheck((code == 200 || code == 206) && acceptedType, code, contentType);
    }

    private void closeQuietly(InputStream stream) {
        if (stream == null) {
            return;
        }
        try {
            stream.close();
        } catch (Exception ignored) {
        }
    }

    private void addMp4Quality(CapturedRequest request, List<JSObject> qualities) {
        JSObject quality = new JSObject();
        quality.put("id", "q" + (qualities.size() + 1));
        quality.put("label", "Auto");
        quality.put("url", request.url);
        quality.put("bandwidth", 0);
        quality.put("type", "mp4");
        qualities.add(quality);
    }

    private void logFetchFailureDiagnostics(FetchResult result, List<String> debug) {
        String requestHeaders = "REQHEADERS "
                + result.requestHeaderNames.toString()
                + " | cookieSent=" + result.cookieSent
                + " | cookieLength=" + result.cookieLength;
        logAndAddDebug(debug, requestHeaders);
        logAndAddDebug(debug, result.responseHeaders);
        String blockText = result.body.replaceAll("<[^>]*>", " ")
                .replaceAll("\\s+", " ").trim();
        if (blockText.length() > 300) {
            blockText = blockText.substring(0, 300);
        }
        logAndAddDebug(debug, "BLOCKTEXT " + (blockText.isEmpty() ? "no body" : blockText));
        if (result.code >= 400 && result.body.length() > 0) {
            logDebugEntry("Playlist error body: "
                    + result.body.substring(0, Math.min(200, result.body.length())));
        }
    }

    private void logAndAddDebug(List<String> debug, String entry) {
        synchronized (debug) {
            debug.add(entry);
        }
        logDebugEntry(entry);
    }

    private void rejectPlaylistFetch(PluginCall call, FetchResult result, List<String> debug,
                                     boolean[] completed) {
        if (completed[0]) {
            return;
        }
        String reason = result.code != 0 ? String.valueOf(result.code)
                : result.error == null ? "unknown" : result.error;
        logAndAddDebug(debug, "STREAM fetch-failed | " + reason);
        completed[0] = true;
        JSObject errorData = new JSObject();
        JSArray debugArray = new JSArray();
        synchronized (debug) {
            for (String item : debug) {
                debugArray.put(item);
            }
        }
        errorData.put("debug", debugArray);
        call.reject("Playlist fetch failed: " + reason, (String) null, errorData);
    }

    private void startWebViewPlaylistRetry(CapturedRequest request, FetchResult result, String referer,
                                           WeakReference<WebView>[] webViewRef, boolean[] pending,
                                           CapturedRequest[] pendingRequest, FetchResult[] nativeResult,
                                           Runnable[] timeoutTask, Handler handler, List<String> debug,
                                           boolean[] completed, PluginCall call) {
        WebView webView = webViewRef[0] == null ? null : webViewRef[0].get();
        if (webView == null || completed[0]) {
            logAndAddDebug(debug, "WEBVIEW-FETCH failed | bytes=0");
            rejectPlaylistFetch(call, result, debug, completed);
            return;
        }
        pending[0] = true;
        pendingRequest[0] = request;
        nativeResult[0] = result;
        timeoutTask[0] = new Runnable() {
            @Override
            public void run() {
                if (!pending[0]) {
                    return;
                }
                pending[0] = false;
                logAndAddDebug(debug, "WEBVIEW-FETCH failed | bytes=0");
                rejectPlaylistFetch(call, result, debug, completed);
            }
        };
        handler.postDelayed(timeoutTask[0], 8000L);
        Map<String, String> extraHeaders = new LinkedHashMap<String, String>();
        if (referer != null && !referer.trim().isEmpty()) {
            extraHeaders.put("Referer", referer);
        }
        try {
            webView.loadUrl(request.url, extraHeaders);
        } catch (RuntimeException exception) {
            pending[0] = false;
            handler.removeCallbacks(timeoutTask[0]);
            logAndAddDebug(debug, "WEBVIEW-FETCH failed | bytes=0");
            logDebugEntry("WebView playlist retry failed: " + exception.getClass().getName()
                    + ": " + String.valueOf(exception.getMessage()));
            rejectPlaylistFetch(call, result, debug, completed);
        }
    }

    private String decodeJavascriptString(String value) {
        if (value == null || value.trim().isEmpty() || "null".equals(value)) {
            return "";
        }
        try {
            Object decoded = new JSONTokener(value).nextValue();
            return decoded instanceof String ? (String) decoded : String.valueOf(decoded);
        } catch (Exception ignored) {
            return value;
        }
    }

    private byte[] readFully(InputStream stream) throws Exception {
        if (stream == null) {
            return new byte[0];
        }
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private boolean isRedirect(int code) {
        return code == HttpURLConnection.HTTP_MOVED_PERM
                || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER
                || code == 307
                || code == 308;
    }

    private String getHeader(Map<String, String> headers, String name) {
        if (headers == null || name == null) {
            return null;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(name)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String firstNonEmpty(String preferred, String fallback) {
        return preferred != null && !preferred.trim().isEmpty() ? preferred : fallback;
    }

    private String originFromReferer(String referer) {
        if (referer == null || referer.trim().isEmpty()) {
            return "";
        }
        try {
            URL refererUrl = new URL(referer);
            return refererUrl.getProtocol() + "://" + refererUrl.getHost();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String buildFetchDebugEntry(CapturedRequest request, FetchResult result, String prefix) {
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
        } catch (Exception ignored) { }
        if (path.length() > 40) {
            path = path.substring(0, 40);
        }
        String bodyPrefix = prefix == null ? "FETCH " : prefix + "FETCH ";
        return bodyPrefix + host + path
                + " | http=" + result.code
                + " | contentType=" + String.valueOf(result.contentType)
                + " | bytes=" + result.byteLength
                + " | startsWithEXTM3U=" + result.startsWithExtM3u
                + " | finalHost=" + result.finalHost
                + " | error=" + (result.error == null ? "none" : result.error);
    }

    private String buildBodyDebugEntry(FetchResult result, String prefix) {
        String bodyPrefix = prefix == null ? "BODY " : prefix + "BODY ";
        if (result == null || result.body.isEmpty()) {
            return bodyPrefix + "no body";
        }
        String clean = shortenLongTokens(result.body.replace("\r\n", "\n").replace("\r", " ⏎ ").replace("\n", " ⏎ "));
        if (clean.length() > 400) {
            clean = clean.substring(0, 400);
        }
        return bodyPrefix + clean;
    }

    private void processPlaylistBody(CapturedRequest request, String body, List<JSObject> qualities,
                                     List<String> debug, String userAgent, String referer,
                                     List<CapturedRequest> captured) {
        boolean isMaster = body.contains("#EXT-X-STREAM-INF");
        
        if (!isMaster) {
            processMediaPlaylist(request, body, qualities, debug, userAgent, referer, null, 0, null, null);
            return;
        }

        String masterUrl = request.url;
        ParsedMaster parsed = parseMasterPlaylist(body, masterUrl);
        
        if (parsed.variants.isEmpty()) {
            processMediaPlaylist(request, body, qualities, debug, userAgent, referer, masterUrl, 0, null, null);
            return;
        }

        List<VariantFetchTask> tasks = new ArrayList<>();
        for (int i = 0; i < parsed.variants.size(); i++) {
            MasterVariant variant = parsed.variants.get(i);
            tasks.add(new VariantFetchTask(i, variant, masterUrl, parsed.mediaGroups, userAgent, referer));
        }

        ExecutorService executor = Executors.newFixedThreadPool(4);
        AtomicInteger completedCount = new AtomicInteger(0);
        
        for (VariantFetchTask task : tasks) {
            executor.submit(() -> {
                task.run();
                completedCount.incrementAndGet();
            });
        }

        try {
            long startTime = System.currentTimeMillis();
            while (completedCount.get() < tasks.size()) {
                if (System.currentTimeMillis() - startTime > 15000) {
                    break;
                }
                Thread.sleep(100);
            }
        } catch (InterruptedException ignored) {
        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(2, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException ignored) {
            }
        }

        List<QualityResult> results = new ArrayList<>();
        for (int i = 0; i < tasks.size(); i++) {
            VariantFetchTask task = tasks.get(i);
            if (task.result != null) {
                results.add(task.result);
            } else {
                QualityResult failed = new QualityResult();
                failed.variant = tasks.get(i).variant;
                failed.error = "fetch timeout";
                results.add(failed);
            }
        }

        List<QualityResult> finalQualities = new ArrayList<>();
        for (QualityResult qr : results) {
            if (qr.error != null) {
                addQualityWithError(qr.variant, qr.error, qualities, debug);
            } else {
                finalQualities.add(qr);
            }
        }

        sortQualities(finalQualities);
        
        for (int i = 0; i < finalQualities.size(); i++) {
            QualityResult qr = finalQualities.get(i);
            addQualityToList(qr, qualities, debug, masterUrl, i + 1);
        }

        logQualityDebug(finalQualities, debug, masterUrl);
        logSubReqDebug(captured, debug);
    }

    private void processMediaPlaylist(CapturedRequest request, String body, List<JSObject> qualities,
                                      List<String> debug, String userAgent, String referer,
                                      String masterUrl, int variantIndex, MasterVariant variant,
                                      Map<String, List<AudioMedia>> mediaGroups) {
        ParsedMedia parsed = parseMediaPlaylist(body, request.url);
        
        QualityResult result = new QualityResult();
        if (variant != null) {
            result.variant = variant;
        } else {
            MasterVariant v = new MasterVariant();
            v.url = request.url;
            v.resolution = "";
            v.bandwidth = 0;
            v.avgBandwidth = 0;
            v.codecs = "";
            v.audioGroup = null;
            result.variant = v;
        }
        result.segmentCount = parsed.segmentCount;
        result.durationSec = parsed.durationSec;
        result.container = parsed.container;
        result.encrypted = parsed.encrypted;
        result.keyMethod = parsed.keyMethod;
        result.live = parsed.live;
        
        if (variant != null && variant.audioGroup != null) {
            AudioMedia audioMedia = findAudioMedia(variant.audioGroup, mediaGroups, request.url);
            if (audioMedia != null) {
                ParsedMedia audioParsed = fetchAndParseMediaPlaylist(audioMedia.url, userAgent, referer);
                if (audioParsed != null) {
                    result.audioUrl = audioMedia.url;
                    result.audioSegmentCount = audioParsed.segmentCount;
                    result.audioDurationSec = audioParsed.durationSec;
                }
            }
        }

        long bw = result.variant.avgBandwidth > 0 ? result.variant.avgBandwidth : result.variant.bandwidth;
        if (result.durationSec > 0 && bw > 0) {
            double est = (bw * result.durationSec) / 8.0;
            if (result.audioUrl != null && result.variant.avgBandwidth <= 0) {
                est += (128000.0 * result.durationSec) / 8.0;
            }
            result.estBytes = Math.round(est);
        } else {
            result.estBytes = -1;
        }

        addQualityToList(result, qualities, debug, masterUrl, variantIndex > 0 ? variantIndex : 1);
    }

    private ParsedMedia fetchAndParseMediaPlaylist(String url, String userAgent, String referer) {
        CapturedRequest tempRequest = new CapturedRequest(url, "hls", new LinkedHashMap<String, String>());
        FetchResult result = fetchPlaylist(tempRequest, userAgent, referer);
        if (result.code == 200 && result.startsWithExtM3u) {
            return parseMediaPlaylist(result.body, url);
        }
        return null;
    }

    private AudioMedia findAudioMedia(String groupId, Map<String, List<AudioMedia>> mediaGroups, String masterUrl) {
        List<AudioMedia> audios = mediaGroups.get(groupId);
        if (audios == null || audios.isEmpty()) {
            return null;
        }
        for (AudioMedia am : audios) {
            if (am.isDefault) {
                return am;
            }
        }
        return audios.get(0);
    }

    private ParsedMaster parseMasterPlaylist(String body, String masterUrl) {
        ParsedMaster result = new ParsedMaster();
        result.masterUrl = masterUrl;
        
        String[] lines = body.split("\\r?\\n");
        String pendingStreamInfo = null;
        String pendingStreamInfoLine = null;
        String currentMediaGroup = null;
        
        for (String line : lines) {
            String trimmed = line.trim();
            
            if (trimmed.startsWith("#EXT-X-MEDIA:")) {
                AudioMedia am = parseAudioMedia(trimmed, masterUrl);
                if (am != null) {
                    result.mediaGroups.computeIfAbsent(am.groupId, k -> new ArrayList<>()).add(am);
                }
                continue;
            }
            
            if (trimmed.startsWith("#EXT-X-STREAM-INF:")) {
                pendingStreamInfo = trimmed;
                pendingStreamInfoLine = trimmed;
                continue;
            }
            
            if (pendingStreamInfo != null && !trimmed.isEmpty() && !trimmed.startsWith("#")) {
                String variantUrl;
                try {
                    variantUrl = new URL(new URL(masterUrl), trimmed).toString();
                } catch (Exception ignored) {
                    pendingStreamInfo = null;
                    continue;
                }
                
                MasterVariant variant = new MasterVariant();
                variant.url = variantUrl;
                variant.originalStreamInfo = pendingStreamInfoLine;
                
                Matcher resMatch = Pattern.compile("RESOLUTION=(\\d+)x(\\d+)", Pattern.CASE_INSENSITIVE).matcher(pendingStreamInfo);
                if (resMatch.find()) {
                    variant.width = parseInt(resMatch.group(1));
                    variant.height = parseInt(resMatch.group(2));
                    variant.resolution = variant.width + "x" + variant.height;
                }
                
                Matcher bwMatch = Pattern.compile("BANDWIDTH=(\\d+)", Pattern.CASE_INSENSITIVE).matcher(pendingStreamInfo);
                if (bwMatch.find()) {
                    variant.bandwidth = parseLong(bwMatch.group(1));
                }
                
                Matcher avgBwMatch = Pattern.compile("AVERAGE-BANDWIDTH=(\\d+)", Pattern.CASE_INSENSITIVE).matcher(pendingStreamInfo);
                if (avgBwMatch.find()) {
                    variant.avgBandwidth = parseLong(avgBwMatch.group(1));
                }
                
                Matcher codecMatch = Pattern.compile("CODECS=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(pendingStreamInfo);
                if (codecMatch.find()) {
                    variant.codecs = codecMatch.group(1);
                }
                
                Matcher audioMatch = Pattern.compile("AUDIO=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(pendingStreamInfo);
                if (audioMatch.find()) {
                    variant.audioGroup = audioMatch.group(1);
                }
                
                result.variants.add(variant);
                pendingStreamInfo = null;
                pendingStreamInfoLine = null;
            }
        }
        
        return result;
    }

    private AudioMedia parseAudioMedia(String line, String masterUrl) {
        Pattern attrPattern = Pattern.compile("([A-Z-]+)=\"([^\"]*)\"", Pattern.CASE_INSENSITIVE);
        Matcher matcher = attrPattern.matcher(line);
        
        String type = null;
        String groupId = null;
        String name = null;
        String language = null;
        String isDefault = null;
        String uri = null;
        
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = matcher.group(2);
            if ("TYPE".equalsIgnoreCase(key)) type = value;
            else if ("GROUP-ID".equalsIgnoreCase(key)) groupId = value;
            else if ("NAME".equalsIgnoreCase(key)) name = value;
            else if ("LANGUAGE".equalsIgnoreCase(key)) language = value;
            else if ("DEFAULT".equalsIgnoreCase(key)) isDefault = value;
            else if ("URI".equalsIgnoreCase(key)) uri = value;
        }
        
        if (!"AUDIO".equalsIgnoreCase(type) || groupId == null) {
            return null;
        }
        
        AudioMedia am = new AudioMedia();
        am.groupId = groupId;
        am.name = name;
        am.language = language;
        am.isDefault = "YES".equalsIgnoreCase(isDefault);
        
        if (uri != null && !uri.isEmpty()) {
            try {
                am.url = new URL(new URL(masterUrl), uri).toString();
            } catch (Exception ignored) {
                am.url = uri;
            }
        }
        
        return am;
    }

    private ParsedMedia parseMediaPlaylist(String body, String playlistUrl) {
        ParsedMedia result = new ParsedMedia();
        result.playlistUrl = playlistUrl;
        
        String[] lines = body.split("\\r?\\n");
        boolean hasExtMap = false;
        boolean hasEndList = false;
        boolean hasKey = false;
        String keyMethod = "NONE";
        double totalDuration = 0;
        int segmentCount = 0;
        
        for (String line : lines) {
            String trimmed = line.trim();
            
            if (trimmed.startsWith("#EXT-X-MAP")) {
                hasExtMap = true;
            } else if (trimmed.startsWith("#EXT-X-ENDLIST")) {
                hasEndList = true;
            } else if (trimmed.startsWith("#EXT-X-KEY:")) {
                Matcher methodMatch = Pattern.compile("METHOD=([^,]+)", Pattern.CASE_INSENSITIVE).matcher(trimmed);
                if (methodMatch.find()) {
                    keyMethod = methodMatch.group(1);
                    if (!"NONE".equalsIgnoreCase(keyMethod)) {
                        hasKey = true;
                    }
                }
            } else if (trimmed.startsWith("#EXTINF:")) {
                String durationStr = trimmed.substring(8).split(",")[0].trim();
                try {
                    totalDuration += Double.parseDouble(durationStr);
                    segmentCount++;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        
        result.segmentCount = segmentCount;
        result.durationSec = (int) Math.round(totalDuration);
        result.container = hasExtMap ? "fmp4" : "ts";
        result.encrypted = hasKey;
        result.keyMethod = keyMethod;
        result.live = !hasEndList;
        
        return result;
    }

    private void sortQualities(List<QualityResult> qualities) {
        qualities.sort(new Comparator<QualityResult>() {
            @Override
            public int compare(QualityResult a, QualityResult b) {
                int bwA = a.variant.avgBandwidth > 0 ? (int) a.variant.avgBandwidth : (int) a.variant.bandwidth;
                int bwB = b.variant.avgBandwidth > 0 ? (int) b.variant.avgBandwidth : (int) b.variant.bandwidth;
                int bwDiff = Integer.compare(bwB, bwA);
                if (bwDiff != 0) return bwDiff;
                
                String codecA = a.variant.codecs != null ? a.variant.codecs.toLowerCase() : "";
                String codecB = b.variant.codecs != null ? b.variant.codecs.toLowerCase() : "";
                boolean avc1A = codecA.contains("avc1");
                boolean avc1B = codecB.contains("avc1");
                if (avc1A && !avc1B) return -1;
                if (!avc1A && avc1B) return 1;
                
                return 0;
            }
        });
    }

    private String getLabel(MasterVariant variant) {
        if (variant.width > 0 && variant.height > 0) {
            if (variant.width >= 1800) return "1080p";
            if (variant.width >= 1200) return "720p";
            if (variant.width >= 800) return "480p";
            if (variant.width >= 600) return "360p";
            return variant.height + "p";
        } else if (variant.height > 0) {
            if (variant.height >= 1000) return "1080p";
            if (variant.height >= 700) return "720p";
            if (variant.height >= 450) return "480p";
            return "360p";
        }
        return "Auto";
    }

    private String getCodec(String codecs) {
        if (codecs == null || codecs.isEmpty()) return "unknown";
        String lower = codecs.toLowerCase();
        if (lower.contains("hev1") || lower.contains("hvc1")) return "hev1";
        if (lower.contains("avc1")) return "avc1";
        return codecs.split("[.,]")[0].trim();
    }

    private void addQualityToList(QualityResult qr, List<JSObject> qualities, List<String> debug,
                                  String masterUrl, int index) {
        JSObject quality = new JSObject();
        quality.put("id", "q" + index);
        quality.put("label", getLabel(qr.variant));
        quality.put("resolution", qr.variant.resolution);
        quality.put("width", qr.variant.width);
        quality.put("height", qr.variant.height);
        quality.put("codec", getCodec(qr.variant.codecs));
        quality.put("bandwidth", qr.variant.bandwidth);
        quality.put("avgBandwidth", qr.variant.avgBandwidth);
        quality.put("url", qr.variant.url);
        if (qr.audioUrl != null) {
            quality.put("audioUrl", qr.audioUrl);
        }
        quality.put("container", qr.container);
        quality.put("encrypted", qr.encrypted);
        if (qr.keyMethod != null) {
            quality.put("keyMethod", qr.keyMethod);
        }
        quality.put("segmentCount", qr.segmentCount);
        if (qr.durationSec > 0) {
            quality.put("durationSec", qr.durationSec);
        }
        if (qr.estBytes >= 0) {
            quality.put("estBytes", qr.estBytes);
        }
        quality.put("live", qr.live);
        quality.put("type", "hls");
        
        synchronized (qualities) {
            qualities.add(quality);
        }
    }

    private void addQualityWithError(MasterVariant variant, String error, List<JSObject> qualities, List<String> debug) {
        JSObject quality = new JSObject();
        quality.put("id", "q" + (qualities.size() + 1));
        quality.put("label", getLabel(variant));
        quality.put("resolution", variant.resolution);
        quality.put("width", variant.width);
        quality.put("height", variant.height);
        quality.put("codec", getCodec(variant.codecs));
        quality.put("bandwidth", variant.bandwidth);
        quality.put("avgBandwidth", variant.avgBandwidth);
        quality.put("url", variant.url);
        quality.put("container", "unknown");
        quality.put("encrypted", false);
        quality.put("segmentCount", JSONObject.NULL);
        quality.put("durationSec", JSONObject.NULL);
        quality.put("estBytes", JSONObject.NULL);
        quality.put("live", false);
        quality.put("type", "hls");
        quality.put("error", error);
        
        synchronized (qualities) {
            qualities.add(quality);
        }
        
        String debugLine = "Q " + getLabel(variant) + " " + variant.resolution + " " + getCodec(variant.codecs)
                + " | bw=" + variant.bandwidth + " | seg=null | dur=null | est=nullMB | container=unknown | enc=false | audio=false | live=false // " + error;
        logAndAddDebug(debug, debugLine);
    }

    private void logQualityDebug(List<QualityResult> qualities, List<String> debug, String masterUrl) {
        for (QualityResult qr : qualities) {
            String label = getLabel(qr.variant);
            String resolution = qr.variant.resolution;
            String codec = getCodec(qr.variant.codecs);
            long bw = qr.variant.avgBandwidth > 0 ? qr.variant.avgBandwidth : qr.variant.bandwidth;
            int seg = qr.segmentCount;
            int dur = qr.durationSec;
            String est = qr.estBytes >= 0 ? String.format(Locale.US, "%.1f", qr.estBytes / 1024.0 / 1024.0) : "null";
            String container = qr.container;
            String enc = qr.encrypted ? qr.keyMethod : "false";
            String audio = qr.audioUrl != null ? "true" : "false";
            String live = qr.live ? "true" : "false";
            
            String line = "Q " + label + " " + resolution + " " + codec
                    + " | bw=" + bw
                    + " | seg=" + seg
                    + " | dur=" + dur
                    + " | est=" + est + "MB"
                    + " | container=" + container
                    + " | enc=" + enc
                    + " | audio=" + audio
                    + " | live=" + live;
            
            logAndAddDebug(debug, line);
        }
    }

    private void logSubReqDebug(List<CapturedRequest> captured, List<String> debug) {
        List<String> subReqs = new ArrayList<>();
        for (CapturedRequest req : captured) {
            String lower = req.url.toLowerCase(Locale.US);
            if (lower.contains("sub") || lower.contains("caption") || lower.contains("vtt") 
                    || lower.contains("srt") || lower.contains("track") || lower.contains("cc")) {
                try {
                    Uri uri = Uri.parse(req.url);
                    String host = uri.getHost() != null ? uri.getHost() : "unknown";
                    String path = uri.getEncodedPath() != null ? uri.getEncodedPath() : "/";
                    String query = uri.getEncodedQuery();
                    if (query != null && !query.isEmpty()) {
                        path = path + "?" + query;
                    }
                    if (path.length() > 60) path = path.substring(0, 60);
                    subReqs.add(host + path);
                } catch (Exception ignored) {
                    subReqs.add(req.url);
                }
            }
        }
        if (!subReqs.isEmpty()) {
            String line = "SUBREQ " + subReqs.subList(0, Math.min(30, subReqs.size())).toString()
                    .replace("[", "").replace("]", "").replace(", ", " | ");
            logAndAddDebug(debug, line);
        }
    }

    private String shortenLongTokens(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "";
        }
        Matcher matcher = LONG_TOKEN_PATTERN.matcher(value);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String token = matcher.group();
            String shortened = token.length() > 12 ? token.substring(0, 12) + "…" : token;
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(shortened));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private void logDebugEntry(String entry) {
        try {
            if (entry == null || entry.isEmpty()) {
                return;
            }
            for (int start = 0; start < entry.length(); start += 900) {
                Log.d(TAG, entry.substring(start, Math.min(start + 900, entry.length())));
            }
        } catch (Throwable ignored) {
        }
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

    private int parseInt(String value) {
        if (value == null || value.trim().isEmpty()) {
            return -1;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception e) {
            return -1;
        }
    }

    private static class CapturedRequest {
        final String url;
        final String type;
        final Map<String, String> headers;
        volatile FetchResult fetchResult;

        CapturedRequest(String url, String type, Map<String, String> headers) {
            this.url = url;
            this.type = type;
            this.headers = headers == null ? new LinkedHashMap<String, String>() : headers;
        }
    }

    private static class FetchResult {
        final int code;
        final String contentType;
        final String body;
        final int byteLength;
        final boolean startsWithExtM3u;
        final String finalHost;
        final String error;
        final List<String> requestHeaderNames;
        final boolean cookieSent;
        final int cookieLength;
        final String responseHeaders;

        FetchResult(int code, String contentType, String body, int byteLength,
                    boolean startsWithExtM3u, String finalHost, String error,
                    List<String> requestHeaderNames, boolean cookieSent, int cookieLength,
                    String responseHeaders) {
            this.code = code;
            this.contentType = contentType;
            this.body = body;
            this.byteLength = byteLength;
            this.startsWithExtM3u = startsWithExtM3u;
            this.finalHost = finalHost;
            this.error = error;
            this.requestHeaderNames = new ArrayList<String>(requestHeaderNames);
            this.cookieSent = cookieSent;
            this.cookieLength = cookieLength;
            this.responseHeaders = responseHeaders;
        }

        FetchResult withBody(String replacementBody) {
            int replacementLength = replacementBody.getBytes(StandardCharsets.UTF_8).length;
            return new FetchResult(code, contentType, replacementBody, replacementLength,
                    replacementBody.startsWith("#EXTM3U"), finalHost, error, requestHeaderNames,
                    cookieSent, cookieLength, responseHeaders);
        }
    }

    private static class MediaCheck {
        final boolean valid;
        final int code;
        final String contentType;

        MediaCheck(boolean valid, int code, String contentType) {
            this.valid = valid;
            this.code = code;
            this.contentType = contentType;
        }
    }

    private static class ParsedMaster {
        String masterUrl;
        List<MasterVariant> variants = new ArrayList<>();
        Map<String, List<AudioMedia>> mediaGroups = new LinkedHashMap<>();
    }

    private static class MasterVariant {
        String url;
        String originalStreamInfo;
        String resolution = "";
        int width = 0;
        int height = 0;
        long bandwidth = 0;
        long avgBandwidth = 0;
        String codecs = "";
        String audioGroup = null;
    }

    private static class AudioMedia {
        String groupId;
        String name;
        String language;
        boolean isDefault = false;
        String url;
    }

    private static class ParsedMedia {
        String playlistUrl;
        int segmentCount = 0;
        int durationSec = 0;
        String container = "ts";
        boolean encrypted = false;
        String keyMethod = "NONE";
        boolean live = false;
    }

    private static class QualityResult {
        MasterVariant variant;
        int segmentCount = 0;
        int durationSec = 0;
        String container = "ts";
        boolean encrypted = false;
        String keyMethod = "NONE";
        boolean live = false;
        String audioUrl = null;
        int audioSegmentCount = 0;
        int audioDurationSec = 0;
        long estBytes = -1;
        String error = null;
    }

    private static class VariantFetchTask implements Runnable {
        final int index;
        final MasterVariant variant;
        final String masterUrl;
        final Map<String, List<AudioMedia>> mediaGroups;
        final String userAgent;
        final String referer;
        QualityResult result;
        
        VariantFetchTask(int index, MasterVariant variant, String masterUrl,
                         Map<String, List<AudioMedia>> mediaGroups, String userAgent, String referer) {
            this.index = index;
            this.variant = variant;
            this.masterUrl = masterUrl;
            this.mediaGroups = mediaGroups;
            this.userAgent = userAgent;
            this.referer = referer;
        }
        
        @Override
        public void run() {
            result = new QualityResult();
            result.variant = variant;
            
            ParsedMedia parsed = fetchAndParseMediaPlaylist(variant.url, userAgent, referer);
            if (parsed == null) {
                result.error = "variant fetch failed";
                return;
            }
            
            result.segmentCount = parsed.segmentCount;
            result.durationSec = parsed.durationSec;
            result.container = parsed.container;
            result.encrypted = parsed.encrypted;
            result.keyMethod = parsed.keyMethod;
            result.live = parsed.live;
            
            if (variant.audioGroup != null) {
                AudioMedia audioMedia = findAudioMediaStatic(variant.audioGroup, mediaGroups, masterUrl);
                if (audioMedia != null) {
                    ParsedMedia audioParsed = fetchAndParseMediaPlaylist(audioMedia.url, userAgent, referer);
                    if (audioParsed != null) {
                        result.audioUrl = audioMedia.url;
                        result.audioSegmentCount = audioParsed.segmentCount;
                        result.audioDurationSec = audioParsed.durationSec;
                    }
                }
            }
            
            long bw = variant.avgBandwidth > 0 ? variant.avgBandwidth : variant.bandwidth;
            if (result.durationSec > 0 && bw > 0) {
                double est = (bw * result.durationSec) / 8.0;
                if (result.audioUrl != null && variant.avgBandwidth <= 0) {
                    est += (128000.0 * result.durationSec) / 8.0;
                }
                result.estBytes = Math.round(est);
            } else {
                result.estBytes = -1;
            }
        }
        
        private ParsedMedia fetchAndParseMediaPlaylist(String url, String userAgent, String referer) {
            CapturedRequest tempRequest = new CapturedRequest(url, "hls", new LinkedHashMap<String, String>());
            FetchResult fetchResult = fetchPlaylistStatic(tempRequest, userAgent, referer);
            if (fetchResult.code == 200 && fetchResult.startsWithExtM3u) {
                return parseMediaPlaylistStatic(fetchResult.body, url);
            }
            return null;
        }
        
        private static AudioMedia findAudioMediaStatic(String groupId, Map<String, List<AudioMedia>> mediaGroups, String masterUrl) {
            List<AudioMedia> audios = mediaGroups.get(groupId);
            if (audios == null || audios.isEmpty()) {
                return null;
            }
            for (AudioMedia am : audios) {
                if (am.isDefault) {
                    return am;
                }
            }
            return audios.get(0);
        }
        
        private static FetchResult fetchPlaylistStatic(CapturedRequest request, String userAgent, String referer) {
            int code = 0;
            String contentType = null;
            String body = "";
            int byteLength = 0;
            String error = null;
            URL currentUrl = null;
            HttpURLConnection connection = null;
            Map<String, String> headers = buildFetchHeadersStatic(request, userAgent, referer);
            String capturedCookie = getHeaderStatic(request.headers, "Cookie");
            List<String> sentHeaderNames = new ArrayList<String>();
            String sentCookie = null;
            String server = null;
            String cfRay = null;
            String location = null;
            String setCookieNames = "";
            try {
                currentUrl = new URL(request.url);
                int redirects = 0;
                while (true) {
                    connection = (HttpURLConnection) currentUrl.openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(10000);
                    connection.setReadTimeout(15000);
                    sentHeaderNames.clear();
                    for (Map.Entry<String, String> header : headers.entrySet()) {
                        connection.setRequestProperty(header.getKey(), header.getValue());
                        sentHeaderNames.add(header.getKey());
                    }
                    CookieManager cookieManager = CookieManager.getInstance();
                    cookieManager.flush();
                    String webViewCookie = cookieManager.getCookie(currentUrl.toString());
                    sentCookie = joinCookiesStatic(capturedCookie, webViewCookie);
                    if (sentCookie != null) {
                        connection.setRequestProperty("Cookie", sentCookie);
                        sentHeaderNames.add("Cookie");
                    }

                    code = connection.getResponseCode();
                    contentType = connection.getHeaderField("Content-Type");
                    server = connection.getHeaderField("Server");
                    cfRay = connection.getHeaderField("cf-ray");
                    location = connection.getHeaderField("Location");
                    setCookieNames = getSetCookieNamesStatic(connection);
                    InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                    byte[] responseBytes = readFullyStatic(stream);
                    String responseBody = new String(responseBytes, StandardCharsets.UTF_8);
                    if (isRedirectStatic(code) && location != null && redirects < 5) {
                        currentUrl = new URL(currentUrl, location);
                        redirects++;
                        connection.disconnect();
                        connection = null;
                        continue;
                    }
                    body = responseBody;
                    byteLength = responseBytes.length;
                    break;
                }
            } catch (Exception exception) {
                error = exception.getClass().getName() + ": " + String.valueOf(exception.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
            boolean startsWithExtM3u = body.startsWith("#EXTM3U");
            String finalHost = currentUrl != null && currentUrl.getHost() != null
                    ? currentUrl.getHost()
                    : "unknown";
            String responseHeaders = "RESPHEADERS server=" + valueOrNoneStatic(server)
                    + " | cf-ray=" + valueOrNoneStatic(cfRay)
                    + " | content-type=" + valueOrNoneStatic(contentType)
                    + " | location=" + valueOrNoneStatic(location)
                    + " | set-cookie=" + (setCookieNames.isEmpty() ? "none" : setCookieNames);
            return new FetchResult(code, contentType, body, byteLength, startsWithExtM3u, finalHost,
                    error, sentHeaderNames, sentCookie != null, sentCookie == null ? 0 : sentCookie.length(),
                    responseHeaders);
        }
        
        private static Map<String, String> buildFetchHeadersStatic(CapturedRequest request, String userAgent, String fallbackReferer) {
            Map<String, String> headers = new LinkedHashMap<String, String>();
            for (Map.Entry<String, String> entry : request.headers.entrySet()) {
                String name = entry.getKey();
                if (name == null || name.trim().isEmpty() || "Cookie".equalsIgnoreCase(name)
                        || isRestrictedRequestHeaderStatic(name)) {
                    continue;
                }
                headers.put(name, entry.getValue() == null ? "" : entry.getValue());
            }
            putHeaderIfMissingStatic(headers, "User-Agent",
                    firstNonEmptyStatic(userAgent, WebSettings.getDefaultUserAgent(null)));
            putHeaderIfMissingStatic(headers, "Referer", fallbackReferer);
            if (getHeaderStatic(request.headers, "Origin") == null) {
                putHeaderIfMissingStatic(headers, "Origin", originFromRefererStatic(getHeaderStatic(headers, "Referer")));
            }
            putHeaderIfMissingStatic(headers, "Accept", "*/*");
            putHeaderIfMissingStatic(headers, "Accept-Language", "en-US,en;q=0.9");
            setHeaderStatic(headers, "Sec-Fetch-Dest", "empty");
            setHeaderStatic(headers, "Sec-Fetch-Mode", "cors");
            setHeaderStatic(headers, "Sec-Fetch-Site", "cross-site");
            setHeaderStatic(headers, "Accept-Encoding", "identity");
            return headers;
        }
        
        private static boolean isRestrictedRequestHeaderStatic(String name) {
            return "Host".equalsIgnoreCase(name)
                    || "Connection".equalsIgnoreCase(name)
                    || "Content-Length".equalsIgnoreCase(name)
                    || "Transfer-Encoding".equalsIgnoreCase(name)
                    || "Proxy-Connection".equalsIgnoreCase(name);
        }
        
        private static void putHeaderIfMissingStatic(Map<String, String> headers, String name, String value) {
            if (value != null && getHeaderStatic(headers, name) == null) {
                headers.put(name, value);
            }
        }
        
        private static void setHeaderStatic(Map<String, String> headers, String name, String value) {
            String existing = null;
            for (String key : headers.keySet()) {
                if (key.equalsIgnoreCase(name)) {
                    existing = key;
                    break;
                }
            }
            if (existing != null) {
                headers.remove(existing);
            }
            headers.put(name, value);
        }
        
        private static String joinCookiesStatic(String capturedCookie, String webViewCookie) {
            boolean hasCaptured = capturedCookie != null && !capturedCookie.trim().isEmpty();
            boolean hasWebView = webViewCookie != null;
            if (hasCaptured && hasWebView && !webViewCookie.trim().isEmpty()) {
                return capturedCookie + "; " + webViewCookie;
            }
            if (hasCaptured) {
                return capturedCookie;
            }
            return hasWebView ? webViewCookie : null;
        }
        
        private static String getSetCookieNamesStatic(HttpURLConnection connection) {
            List<String> names = new ArrayList<String>();
            Map<String, List<String>> headers = connection.getHeaderFields();
            if (headers == null) {
                return "";
            }
            for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
                if (entry.getKey() == null || !"Set-Cookie".equalsIgnoreCase(entry.getKey()) || entry.getValue() == null) {
                    continue;
                }
                for (String cookie : entry.getValue()) {
                    int equals = cookie == null ? -1 : cookie.indexOf('=');
                    if (equals > 0) {
                        names.add(cookie.substring(0, equals).trim());
                    }
                }
            }
            return names.toString();
        }
        
        private static String valueOrNoneStatic(String value) {
            return value == null || value.trim().isEmpty() ? "none" : value;
        }
        
        private static String getHeaderStatic(Map<String, String> headers, String name) {
            if (headers == null || name == null) {
                return null;
            }
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(name)) {
                    return entry.getValue();
                }
            }
            return null;
        }
        
        private static String firstNonEmptyStatic(String preferred, String fallback) {
            return preferred != null && !preferred.trim().isEmpty() ? preferred : fallback;
        }
        
        private static String originFromRefererStatic(String referer) {
            if (referer == null || referer.trim().isEmpty()) {
                return "";
            }
            try {
                URL refererUrl = new URL(referer);
                return refererUrl.getProtocol() + "://" + refererUrl.getHost();
            } catch (Exception ignored) {
                return "";
            }
        }
        
        private static byte[] readFullyStatic(InputStream stream) throws Exception {
            if (stream == null) {
                return new byte[0];
            }
            try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                return output.toByteArray();
            }
        }
        
        private static boolean isRedirectStatic(int code) {
            return code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == HttpURLConnection.HTTP_SEE_OTHER
                    || code == 307
                    || code == 308;
        }
        
        private static ParsedMedia parseMediaPlaylistStatic(String body, String playlistUrl) {
            ParsedMedia result = new ParsedMedia();
            result.playlistUrl = playlistUrl;
            
            String[] lines = body.split("\\r?\\n");
            boolean hasExtMap = false;
            boolean hasEndList = false;
            boolean hasKey = false;
            String keyMethod = "NONE";
            double totalDuration = 0;
            int segmentCount = 0;
            
            for (String line : lines) {
                String trimmed = line.trim();
                
                if (trimmed.startsWith("#EXT-X-MAP")) {
                    hasExtMap = true;
                } else if (trimmed.startsWith("#EXT-X-ENDLIST")) {
                    hasEndList = true;
                } else if (trimmed.startsWith("#EXT-X-KEY:")) {
                    Matcher methodMatch = Pattern.compile("METHOD=([^,]+)", Pattern.CASE_INSENSITIVE).matcher(trimmed);
                    if (methodMatch.find()) {
                        keyMethod = methodMatch.group(1);
                        if (!"NONE".equalsIgnoreCase(keyMethod)) {
                            hasKey = true;
                        }
                    }
                } else if (trimmed.startsWith("#EXTINF:")) {
                    String durationStr = trimmed.substring(8).split(",")[0].trim();
                    try {
                        totalDuration += Double.parseDouble(durationStr);
                        segmentCount++;
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            
            result.segmentCount = segmentCount;
            result.durationSec = (int) Math.round(totalDuration);
            result.container = hasExtMap ? "fmp4" : "ts";
            result.encrypted = hasKey;
            result.keyMethod = keyMethod;
            result.live = !hasEndList;
            
            return result;
        }
    }
}