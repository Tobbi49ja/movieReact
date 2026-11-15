package com.tobbihub.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

@CapacitorPlugin(name = "Downloader")
public class DownloaderPlugin extends Plugin {

    private DownloadEngine engine;
    private DownloadEngine.Listener pluginListener;
    private boolean notificationPermissionRequested = false;

    @Override
    public void load() {
        pluginListener = new DownloadEngine.Listener() {
            @Override
            public void onStarted(String id) {
                JSObject data = new JSObject();
                data.put("id", id);
                notifyListeners("downloadStarted", data);
            }

            @Override
            public void onProgress(JSONObject p) {
                JSObject data = new JSObject();
                try {
                    data.put("id", p.getString("id"));
                    data.put("percent", p.getInt("percent"));
                    data.put("bytesDone", p.getLong("bytesDone"));
                    data.put("speedBps", p.getLong("speedBps"));
                    data.put("segDone", p.getInt("segDone"));
                    data.put("segTotal", p.getInt("segTotal"));
                    data.put("etaSec", p.getLong("etaSec"));
                } catch (JSONException ignored) {}
                notifyListeners("downloadProgress", data);
            }

            @Override
            public void onPaused(String id) {
                JSObject data = new JSObject();
                data.put("id", id);
                notifyListeners("downloadPaused", data);
            }

            @Override
            public void onComplete(String id, String path, long size) {
                JSObject data = new JSObject();
                data.put("id", id);
                data.put("path", path);
                data.put("size", size);
                notifyListeners("downloadComplete", data);
            }

            @Override
            public void onError(String id, String code, String msg) {
                JSObject data = new JSObject();
                data.put("id", id);
                data.put("code", code);
                data.put("message", msg);
                notifyListeners("downloadError", data);
            }
        };
        engine = new DownloadEngine(getContext(), pluginListener);
        DownloadService.sink = pluginListener;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        DownloadService.sink = null;
    }

    @PluginMethod
    public void start(PluginCall call) {
        JSONObject req = call.getData();
        if (req == null) {
            req = new JSONObject();
        }
        requestNotificationPermissionIfNeeded();
        Intent intent = new Intent(getContext(), DownloadService.class)
                .setAction(DownloadService.ACTION_START)
                .putExtra(DownloadService.EXTRA_REQ, req.toString());
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            Intent intent = new Intent(getContext(), DownloadService.class)
                    .setAction(DownloadService.ACTION_PAUSE)
                    .putExtra(DownloadService.EXTRA_ID, id);
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        String id = call.getString("id");
        JSONObject req = call.getData();
        if (id != null) {
            requestNotificationPermissionIfNeeded();
            Intent intent = new Intent(getContext(), DownloadService.class)
                    .setAction(DownloadService.ACTION_RESUME)
                    .putExtra(DownloadService.EXTRA_ID, id);
            if (req != null) {
                intent.putExtra(DownloadService.EXTRA_REQ, req.toString());
            }
            ContextCompat.startForegroundService(getContext(), intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            Intent intent = new Intent(getContext(), DownloadService.class)
                    .setAction(DownloadService.ACTION_CANCEL)
                    .putExtra(DownloadService.EXTRA_ID, id);
            getContext().startService(intent);
        }
        call.resolve();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationPermissionRequested) {
            Activity activity = getActivity();
            if (activity != null && ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionRequested = true;
                ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSArray items = new JSArray();
        if (engine != null) {
            org.json.JSONArray arr = engine.list();
            for (int i = 0; i < arr.length(); i++) {
                try {
                    items.put(new JSObject(arr.getString(i)));
                } catch (JSONException ignored) {}
            }
        }
        JSObject payload = new JSObject();
        payload.put("items", items);
        call.resolve(payload);
    }

    @PluginMethod
    public void storageInfo(PluginCall call) {
        File baseDir = getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        File dir = baseDir != null ? baseDir : getContext().getFilesDir();
        long freeBytes = 0;
        try {
            StatFs stat = new StatFs(dir.getAbsolutePath());
            freeBytes = stat.getAvailableBytes();
        } catch (Exception ignored) {}
        JSObject payload = new JSObject();
        payload.put("freeBytes", freeBytes);
        call.resolve(payload);
    }
}