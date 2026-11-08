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
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webview = bridge.getWebView();

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
                if (!request.isForMainFrame()) {
                    Uri uri = request.getUrl();
                    String scheme = uri != null ? uri.getScheme() : null;
                    if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                        Log.d("MainActivity", "Blocked subframe scheme: " + uri);
                        return true;
                    }
                    return false;
                }
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if ("moviereact-zzye.onrender.com".equals(host)) {
                    return false;
                }
                if ("capacitor".equals(scheme) || "file".equals(scheme) || "about".equals(scheme)
                        || "blob".equals(scheme) || "data".equals(scheme)) {
                    return false;
                }
                if ("mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme)
                        || "whatsapp".equals(scheme) || "tg".equals(scheme)) {
                    return false;
                }
                Log.d("MainActivity", "Blocked nav: " + uri.toString());
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

                try {
                    WebSettings settings = view.getSettings();
                    settings.setSupportMultipleWindows(true);
                } catch (Exception e) {
                    Log.d("MainActivity", "setSupportMultipleWindows failed: " + e);
                }

                WebView temp = new WebView(view.getContext());
                temp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        Uri url = request.getUrl();
                        String host = url.getHost();
                        String scheme = url.getScheme();
                        boolean isHttp = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
                        boolean external = host != null && (
                            host.equals("wa.me") || host.endsWith(".wa.me") ||
                            host.equals("whatsapp.com") || host.endsWith(".whatsapp.com") ||
                            host.equals("t.me") || host.endsWith(".t.me") ||
                            host.equals("telegram.me") || host.endsWith(".telegram.me") ||
                            host.equals("instagram.com") || host.endsWith(".instagram.com") ||
                            host.equals("facebook.com") || host.endsWith(".facebook.com") ||
                            host.equals("x.com") || host.endsWith(".x.com") ||
                            host.equals("twitter.com") || host.endsWith(".twitter.com") ||
                            host.equals("tiktok.com") || host.endsWith(".tiktok.com") ||
                            host.equals("youtube.com") || host.endsWith(".youtube.com")
                        );
                        if (!isHttp || !external) {
                            return true;
                        }
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, url);
                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            view.getContext().startActivity(intent);
                        } catch (Exception e) {
                            Log.d("MainActivity", "startActivity failed: " + e);
                        }
                        return true;
                    }
                });

                try {
                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(temp);
                    resultMsg.sendToTarget();
                } catch (Exception e) {
                    Log.d("MainActivity", "attach popup failed: " + e);
                    temp.destroy();
                    return true;
                }

                new Handler(Looper.getMainLooper()).postDelayed(temp::destroy, 400);
                return true;
            }
        });
    }
}