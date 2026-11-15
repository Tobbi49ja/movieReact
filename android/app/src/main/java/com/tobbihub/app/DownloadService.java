package com.tobbihub.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

public class DownloadService extends Service {
    private static final String TAG = "Downloader";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ONGOING = "tobbihub_downloads";
    private static final String CHANNEL_DONE = "tobbihub_downloads_done";
    private static final long PROGRESS_UPDATE_INTERVAL_MS = 1000;

    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_PAUSE = "ACTION_PAUSE";
    public static final String ACTION_RESUME = "ACTION_RESUME";
    public static final String ACTION_CANCEL = "ACTION_CANCEL";
    public static final String EXTRA_REQ = "req";
    public static final String EXTRA_ID = "id";

    public static volatile DownloadEngine.Listener sink;

    private DownloadEngine engine;
    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private final Set<String> activeIds = new HashSet<>();
    private String currentTitle = "";
    private long lastProgressLogTime = 0;
    private long lastNotificationUpdate = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannels();
        engine = new DownloadEngine(this, new DownloadEngine.Listener() {
            @Override
            public void onStarted(String id) {
                if (sink != null) sink.onStarted(id);
                activeIds.add(id);
                acquireWakeLock();
                startForegroundIfNeeded();
                Log.d(TAG, "Download started: " + id);
            }

            @Override
            public void onProgress(JSONObject p) {
                if (sink != null) sink.onProgress(p);
                String id = p.optString("id");
                int percent = p.optInt("percent");
                long speedBps = p.optLong("speedBps");
                long now = System.currentTimeMillis();
                if (now - lastProgressLogTime >= 10000) {
                    Log.d(TAG, "Progress: " + id + " " + percent + "% " + (speedBps / 1024 / 1024) + " MB/s");
                    lastProgressLogTime = now;
                }
                updateNotification(id, percent, speedBps);
            }

            @Override
            public void onPaused(String id) {
                if (sink != null) sink.onPaused(id);
                activeIds.remove(id);
                checkAndStop();
                Log.d(TAG, "Download paused: " + id);
            }

            @Override
            public void onComplete(String id, String path, long size) {
                if (sink != null) sink.onComplete(id, path, size);
                activeIds.remove(id);
                postCompleteNotification(id);
                checkAndStop();
                Log.d(TAG, "Download complete: " + id + " size=" + size);
            }

            @Override
            public void onError(String id, String code, String msg) {
                if (sink != null) sink.onError(id, code, msg);
                activeIds.remove(id);
                postErrorNotification(id, code, msg);
                checkAndStop();
                Log.d(TAG, "Download error: " + id + " " + code + " " + msg);
            }
        });
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ongoing = new NotificationChannel(CHANNEL_ONGOING, "Downloads", NotificationManager.IMPORTANCE_LOW);
            ongoing.setDescription("Ongoing download progress");
            notificationManager.createNotificationChannel(ongoing);
            NotificationChannel done = new NotificationChannel(CHANNEL_DONE, "Downloads Done", NotificationManager.IMPORTANCE_DEFAULT);
            done.setDescription("Completed download notifications");
            notificationManager.createNotificationChannel(done);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        String id = intent.getStringExtra(EXTRA_ID);
        try {
            switch (action) {
                case ACTION_START:
                    String reqJson = intent.getStringExtra(EXTRA_REQ);
                    if (reqJson != null) {
                        JSONObject req = new JSONObject(reqJson);
                        currentTitle = req.optString("title", "");
                        startForegroundIfNeeded();
                        engine.start(req);
                    }
                    break;
                case ACTION_PAUSE:
                    if (id != null) engine.pause(id);
                    break;
                case ACTION_RESUME:
                    String resumeReqJson = intent.getStringExtra(EXTRA_REQ);
                    if (id != null) {
                        if (resumeReqJson != null) {
                            JSONObject req = new JSONObject(resumeReqJson);
                            currentTitle = req.optString("title", "");
                        }
                        startForegroundIfNeeded();
                        engine.resume(id, resumeReqJson != null ? new JSONObject(resumeReqJson) : null);
                    }
                    break;
                case ACTION_CANCEL:
                    if (id != null) engine.cancel(id);
                    break;
            }
        } catch (JSONException e) {
            Log.e(TAG, "JSON error", e);
        }
        return START_NOT_STICKY;
    }

    private void startForegroundIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildOngoingNotification(0, 0), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, buildOngoingNotification(0, 0));
        }
    }

    private void updateNotification(String id, int percent, long speedBps) {
        long now = System.currentTimeMillis();
        if (now - lastNotificationUpdate < PROGRESS_UPDATE_INTERVAL_MS) return;
        lastNotificationUpdate = now;
        String text = percent + "% - " + (speedBps / 1024 / 1024) + " MB/s";
        Notification notification = buildOngoingNotification(percent, speedBps);
        notificationManager.notify(NOTIFICATION_ID, notification);
    }

    private Notification buildOngoingNotification(int percent, long speedBps) {
        Intent pauseIntent = new Intent(this, DownloadService.class).setAction(ACTION_PAUSE).putExtra(EXTRA_ID, getAnyActiveId());
        Intent cancelIntent = new Intent(this, DownloadService.class).setAction(ACTION_CANCEL).putExtra(EXTRA_ID, getAnyActiveId());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pausePi = PendingIntent.getService(this, 0, pauseIntent, flags);
        PendingIntent cancelPi = PendingIntent.getService(this, 1, cancelIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ONGOING)
                .setContentTitle(currentTitle.isEmpty() ? "Downloading" : currentTitle)
                .setContentText(percent + "% - " + (speedBps / 1024 / 1024) + " MB/s")
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(100, percent, false)
                .addAction(android.R.drawable.ic_media_pause, "Pause", pausePi)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", cancelPi);
        return builder.build();
    }

    private String getAnyActiveId() {
        return activeIds.isEmpty() ? "" : activeIds.iterator().next();
    }

    private void postCompleteNotification(String id) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("route", "/downloads");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, flags);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_DONE)
                .setContentTitle("Download complete")
                .setContentText(currentTitle)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        notificationManager.notify(id.hashCode(), notification);
    }

    private void postErrorNotification(String id, String code, String msg) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_DONE)
                .setContentTitle(currentTitle.isEmpty() ? "Download failed" : currentTitle)
                .setContentText(code + ": " + msg)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setAutoCancel(true)
                .build();
        notificationManager.notify(id.hashCode() + 10000, notification);
    }

    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DownloadService::wakeLock");
        }
        if (!wakeLock.isHeld()) {
            wakeLock.acquire();
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    private void checkAndStop() {
        if (activeIds.isEmpty()) {
            releaseWakeLock();
            stopForeground(true);
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (engine != null) {
            for (String id : new HashSet<>(activeIds)) {
                engine.cancel(id);
            }
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}