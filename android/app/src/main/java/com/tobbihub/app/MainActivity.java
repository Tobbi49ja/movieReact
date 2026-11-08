package com.tobbihub.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private void enqueueNativeDownload(String url, String userAgent, String contentDisposition, String mimeType) {
        if (url == null || url.trim().isEmpty()) {
            return;
        }

        String normalized = url.trim();
        String lower = normalized.toLowerCase(Locale.US);
        boolean isMedia = lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".mkv")
                || lower.contains(".webm") || lower.contains(".vtt") || lower.contains(".srt")
                || lower.contains(".ass") || lower.contains(".ssa");

        if (!isMedia) {
            return;
        }

        try {
            String fileName = URLUtil.guessFileName(normalized, contentDisposition, mimeType);
            if (fileName == null || fileName.trim().isEmpty()) {
                fileName = "tobbihub-download";
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(normalized));
            request.setMimeType(mimeType != null ? mimeType : "application/octet-stream");
            request.addRequestHeader("User-Agent", userAgent != null ? userAgent : "TobbihubApp");
            request.addRequestHeader("Accept", "*/*");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setTitle(fileName);
            request.setDescription("Downloading media");
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                Toast.makeText(this, "Download started: " + fileName, Toast.LENGTH_LONG).show();
                Log.d("MainActivity", "Queued media download: " + normalized);
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Queued media download failed", e);
            Toast.makeText(this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaSnifferPlugin.class);
        registerPlugin(StreamResolverPlugin.class);
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webview = bridge.getWebView();
        WebSettings webSettings = webview.getSettings();
        webSettings.setSupportMultipleWindows(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);

        webview.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                enqueueNativeDownload(url, userAgent, contentDisposition, mimeType);
            }
        });

        webview.setWebViewClient(new BridgeWebViewClient(bridge) {
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
                    Log.d("MainActivity", "Blocked non-http(s) scheme: " + uri);
                    return true;
                }

                if (!request.isForMainFrame()) {
                    return false;
                }

                String host = uri.getHost();
                boolean allowedHost = "moviereact-zzye.onrender.com".equals(host)
                        || "localhost".equals(host)
                        || "127.0.0.1".equals(host)
                        || "10.0.2.2".equals(host)
                        || "0.0.0.0".equals(host)
                        || "::1".equals(host);

                if (allowedHost) {
                    return false;
                }

                Log.d("MainActivity", "Blocked main-frame navigation: " + uri);
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    MediaSnifferPlugin sniffer = MediaSnifferPlugin.getInstance();
                    if (sniffer != null && sniffer.isEnabled()) {
                        try {
                            String url = request.getUrl().toString();
                            if (url != null) {
                                sniffer.recordFound(url, request.getRequestHeaders());
                            }
                        } catch (Exception e) {
                            Log.e("MainActivity", "Media sniffer inspect failed", e);
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        webview.setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                if (resultMsg == null) {
                    Log.d("MainActivity", "Blocked popup: no resultMsg");
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
                popupSettings.setSupportMultipleWindows(true);
                popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                try {
                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(popup);
                    resultMsg.sendToTarget();
                } catch (Exception e) {
                    Log.d("MainActivity", "attach popup failed: " + e);
                    popup.destroy();
                    return true;
                }

                return true;
            }
        });
    }
}