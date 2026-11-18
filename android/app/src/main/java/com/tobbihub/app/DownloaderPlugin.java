package com.tobbihub.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.OpenableColumns;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@CapacitorPlugin(name = "Downloader")
public class DownloaderPlugin extends Plugin {

    private DownloadEngine engine;
    private DownloadEngine.Listener pluginListener;
    private boolean notificationPermissionRequested = false;
    private static final int MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;

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

    @PluginMethod
    public void play(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("INVALID");
            return;
        }
        try {
            File file = new File(path);
            String canonical = file.getCanonicalPath();
            String base = null;
            File ext = getContext().getExternalFilesDir(null);
            File internal = getContext().getFilesDir();
            String extCanonical = ext != null ? ext.getCanonicalPath() : null;
            String intCanonical = internal != null ? internal.getCanonicalPath() : null;
            if (extCanonical != null && canonical.startsWith(extCanonical)) {
                base = extCanonical;
            } else if (intCanonical != null && canonical.startsWith(intCanonical)) {
                base = intCanonical;
            }
            if (base == null || !file.exists()) {
                call.reject("NOT_FOUND");
                return;
            }
        } catch (java.io.IOException e) {
            call.reject("NOT_FOUND");
            return;
        }
        Log.d("Downloader", "play path=" + path + " exists=" + new File(path).exists());
        Intent intent = new Intent(getContext(), PlayerActivity.class)
                .putExtra(PlayerActivity.EXTRA_PATH, path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    // -----------------------------
    // Subtitles
    // -----------------------------

    @PluginMethod
    public void saveSubtitle(PluginCall call) {
        File folder = requireDownloadFolder(call);
        if (folder == null) return;

        String content = call.getString("content");
        if (content == null) {
            call.reject("Missing content");
            return;
        }

        DownloadManifest manifest = DownloadManifest.load(folder);
        if (manifest == null) {
            call.reject("Download not found");
            return;
        }

        String lang = sanitizeLang(call.getString("lang"));
        String label = call.getString("label");
        if (label == null || label.trim().isEmpty()) {
            label = lang;
        }

        try {
            JSONObject entry = writeSubtitleFile(folder, manifest, lang, label.trim(), content);
            manifest.subtitles.put(entry);
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            call.resolve(subtitlesPayload(manifest));
        } catch (Exception e) {
            Log.e("Downloader", "saveSubtitle failed", e);
            call.reject("Failed to save subtitle: " + e.getMessage());
        }
    }

    @PluginMethod
    public void importSubtitle(PluginCall call) {
        if (requireDownloadFolder(call) == null) return;

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                "text/*",
                "application/x-subrip",
                "text/vtt"
        });
        getBridge().executeOnMainThread(() ->
                startActivityForResult(call, intent, "importSubtitleResult"));
    }

    @ActivityCallback
    private void importSubtitleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result == null || result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null || result.getData().getData() == null) {
            call.reject("CANCELLED");
            return;
        }

        File folder = requireDownloadFolder(call);
        if (folder == null) return;

        DownloadManifest manifest = DownloadManifest.load(folder);
        if (manifest == null) {
            call.reject("Download not found");
            return;
        }

        Uri uri = result.getData().getData();
        try {
            String displayName = getDisplayName(uri);
            String content = readText(uri);
            String lang = guessLang(displayName);
            String label = displayLabel(displayName, lang);
            JSONObject entry = writeSubtitleFile(folder, manifest, lang, label, content);
            manifest.subtitles.put(entry);
            manifest.updatedAt = System.currentTimeMillis();
            manifest.save(folder);
            call.resolve(subtitlesPayload(manifest));
        } catch (Exception e) {
            Log.e("Downloader", "importSubtitle failed", e);
            call.reject("Failed to import subtitle: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listSubtitles(PluginCall call) {
        File folder = requireDownloadFolder(call);
        if (folder == null) return;

        DownloadManifest manifest = DownloadManifest.load(folder);
        if (manifest == null) {
            call.reject("Download not found");
            return;
        }
        call.resolve(subtitlesPayload(manifest));
    }

    @PluginMethod
    public void deleteSubtitle(PluginCall call) {
        File folder = requireDownloadFolder(call);
        if (folder == null) return;

        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Missing id");
            return;
        }

        DownloadManifest manifest = DownloadManifest.load(folder);
        if (manifest == null) {
            call.reject("Download not found");
            return;
        }

        JSONArray current = manifest.subtitles != null ? manifest.subtitles : new JSONArray();
        JSONArray next = new JSONArray();
        String relative = null;
        for (int i = 0; i < current.length(); i++) {
            JSONObject entry = current.optJSONObject(i);
            if (entry == null) continue;
            if (id.trim().equals(entry.optString("id"))) {
                relative = entry.optString("file", null);
            } else {
                next.put(entry);
            }
        }

        manifest.subtitles = next;
        manifest.updatedAt = System.currentTimeMillis();
        manifest.save(folder);

        File target = safeResolve(folder, relative);
        if (target != null && target.exists()) {
            target.delete();
        }

        call.resolve(subtitlesPayload(manifest));
    }

    private File requireDownloadFolder(PluginCall call) {
        String downloadId = call.getString("downloadId");
        if (downloadId == null || downloadId.trim().isEmpty()) {
            call.reject("Missing downloadId");
            return null;
        }
        File folder = DownloadEngine.getDownloadFolder(getContext(), downloadId.trim());
        if (!folder.exists() || !folder.isDirectory()) {
            call.reject("Download not found");
            return null;
        }
        return folder;
    }

    private JSObject subtitlesPayload(DownloadManifest manifest) {
        JSObject payload = new JSObject();
        payload.put("subtitles", manifest.subtitles != null ? manifest.subtitles : new JSONArray());
        return payload;
    }

    private JSONObject writeSubtitleFile(File folder, DownloadManifest manifest, String lang, String label, String content) throws Exception {
        File subsDir = new File(folder, "subs");
        if (!subsDir.exists() && !subsDir.mkdirs()) {
            throw new IOException("Cannot create subtitles folder");
        }
        if (manifest.subtitles == null) {
            manifest.subtitles = new JSONArray();
        }

        int n = nextSubtitleNumber(subsDir, manifest, lang);
        String base = lang + "-" + n;
        File target = new File(subsDir, base + ".srt");
        try (FileOutputStream out = new FileOutputStream(target, false)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.flush();
        }

        JSONObject entry = new JSONObject();
        entry.put("id", base);
        entry.put("lang", lang);
        entry.put("label", label);
        entry.put("file", "subs/" + base + ".srt");
        entry.put("offsetMs", 0);
        return entry;
    }

    private int nextSubtitleNumber(File subsDir, DownloadManifest manifest, String lang) {
        int n = 1;
        while (true) {
            String base = lang + "-" + n;
            if (!new File(subsDir, base + ".srt").exists() && !hasSubtitleId(manifest, base)) {
                return n;
            }
            n++;
        }
    }

    private boolean hasSubtitleId(DownloadManifest manifest, String id) {
        if (manifest.subtitles == null) return false;
        for (int i = 0; i < manifest.subtitles.length(); i++) {
            JSONObject entry = manifest.subtitles.optJSONObject(i);
            if (entry != null && id.equals(entry.optString("id"))) {
                return true;
            }
        }
        return false;
    }

    private File safeResolve(File folder, String relative) {
        if (relative == null || relative.isEmpty()) return null;
        try {
            File root = folder.getCanonicalFile();
            File target = new File(root, relative).getCanonicalFile();
            String rootPath = root.getPath() + File.separator;
            if (!target.getPath().startsWith(rootPath)) {
                return null;
            }
            return target;
        } catch (Exception e) {
            return null;
        }
    }

    private String sanitizeLang(String raw) {
        if (raw == null) return "und";
        String cleaned = raw.trim().toLowerCase(Locale.US).replaceAll("[^a-z0-9-]", "");
        if (cleaned.isEmpty()) return "und";
        return cleaned.length() > 16 ? cleaned.substring(0, 16) : cleaned;
    }

    private String getDisplayName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                    uri,
                    new String[] { OpenableColumns.DISPLAY_NAME },
                    null,
                    null,
                    null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        String fallback = uri.getLastPathSegment();
        return fallback != null && !fallback.isEmpty() ? fallback : "subtitle.srt";
    }

    private String readText(Uri uri) throws IOException {
        InputStream input = getContext().getContentResolver().openInputStream(uri);
        if (input == null) {
            throw new IOException("Cannot open file");
        }
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[64 * 1024];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_SUBTITLE_BYTES) {
                    throw new IOException("Subtitle file is too large");
                }
                output.write(buffer, 0, read);
            }
            return decodeBytes(output.toByteArray());
        } finally {
            input.close();
        }
    }

    private String decodeBytes(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF) {
            return new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        }
        if (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xFE) {
            return decodeCharset("UTF-16LE", bytes, 2);
        }
        if (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFE && (bytes[1] & 0xFF) == 0xFF) {
            return decodeCharset("UTF-16BE", bytes, 2);
        }

        String utf8 = decodeStrict("UTF-8", bytes, 0);
        if (utf8 != null) return utf8;

        String cp1252 = decodeStrict("windows-1252", bytes, 0);
        if (cp1252 != null) return cp1252;

        return new String(bytes, StandardCharsets.ISO_8859_1);
    }

    private String decodeStrict(String charsetName, byte[] bytes, int offset) {
        try {
            CharsetDecoder decoder = Charset.forName(charsetName)
                    .newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset)).toString();
        } catch (Exception e) {
            return null;
        }
    }

    private String decodeCharset(String charsetName, byte[] bytes, int offset) {
        try {
            return new String(bytes, offset, bytes.length - offset, Charset.forName(charsetName));
        } catch (Exception e) {
            return new String(bytes, offset, bytes.length - offset, StandardCharsets.UTF_8);
        }
    }

    private String guessLang(String displayName) {
        if (displayName == null) return "und";
        String[] tokens = stripExtension(displayName).split("[^A-Za-z0-9]+");
        for (int i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].matches("[a-z]{2,3}")) {
                return tokens[i];
            }
        }
        return "und";
    }

    private String displayLabel(String displayName, String lang) {
        if (displayName == null || displayName.trim().isEmpty()) return lang;
        String label = stripExtension(displayName).trim();
        return label.isEmpty() ? lang : label;
    }

    private String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}