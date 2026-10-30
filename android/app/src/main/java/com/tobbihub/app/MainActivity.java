package com.tobbihub.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import android.net.Uri;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webView = bridge.getWebView();

        webView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    return super.shouldOverrideUrlLoading(view, request);
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
        });

        webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                Log.d("MainActivity", "Blocked popup: " + (resultMsg != null ? resultMsg.toString() : ""));
                return false;
            }
        });
    }
}
