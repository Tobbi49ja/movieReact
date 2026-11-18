package com.tobbihub.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@SuppressWarnings("deprecation")
public class PlayerActivity extends Activity {

    public static final String EXTRA_PATH = "com.tobbihub.app.EXTRA_PATH";
    private static final String STATE_POSITION = "position";

    private static final String PREFS_NAME = "player_prefs";
    private static final String KEY_TEXT_SIZE = "subtitle_text_size";
    private static final String KEY_LAST_LANG_PREFIX = "last_subtitle_lang_";
    private static final int REQUEST_IMPORT_SUBTITLE = 2001;
    private static final int NETWORK_TIMEOUT_MS = 10000;
    private static final int MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;

    private PlayerView playerView;
    private ExoPlayer player;
    private File videoFile;
    private long savedPosition = 0;

    private DownloadManifest manifest;
    private final List<SubtitleEntry> subtitleEntries = new ArrayList<>();
    private int selectedSubtitleIndex = -1;
    private Dialog subtitleSheet;
    private ProgressDialog progressDialog;

    private static class SubtitleEntry {
        final String id;
        final String lang;
        final String label;
        final File file;
        final String mime;
        long offsetMs;

        SubtitleEntry(String id, String lang, String label, File file, String mime, long offsetMs) {
            this.id = id;
            this.lang = lang;
            this.label = label;
            this.file = file;
            this.mime = mime;
            this.offsetMs = offsetMs;
        }
    }

    private static class SubtitleResult {
        final String lang;
        final String label;
        final String url;

        SubtitleResult(String lang, String label, String url) {
            this.lang = lang;
            this.label = label;
            this.url = url;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (savedInstanceState != null) {
            savedPosition = savedInstanceState.getLong(STATE_POSITION, 0);
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String path = getIntent().getStringExtra(EXTRA_PATH);
        if (path == null || !new File(path).isFile()) {
            Toast.makeText(this, "File not found", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        videoFile = new File(path);
        manifest = DownloadManifest.load(videoFile.getParentFile());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setShowSubtitleButton(false);
        FrameLayout.LayoutParams playerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT);
        playerParams.gravity = Gravity.CENTER;
        root.addView(playerView, playerParams);

        final ImageButton ccButton = new ImageButton(this);
        ccButton.setId(R.id.btn_cc);
        ccButton.setImageResource(R.drawable.ic_cc);
        ccButton.setColorFilter(Color.WHITE, PorterDuff.Mode.SRC_IN);
        ccButton.setBackgroundColor(Color.TRANSPARENT);
        ccButton.setPadding(dp(12), dp(12), dp(12), dp(12));
        ccButton.setEnabled(true);
        ccButton.setAlpha(1f);
        ccButton.setContentDescription("Subtitles");
        int ccSize = dp(48);
        FrameLayout.LayoutParams ccParams = new FrameLayout.LayoutParams(ccSize, ccSize);
        ccParams.gravity = Gravity.TOP | Gravity.END;
        ccParams.setMargins(0, dp(12), dp(12), 0);
        root.addView(ccButton, ccParams);
        ccButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSubtitleSheet();
            }
        });
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> ccButton.setVisibility(visibility));

        Button backButton = new Button(this);
        backButton.setText("←");
        backButton.setTextColor(Color.WHITE);
        backButton.setTextSize(22);
        backButton.setPadding(0, 0, 0, 0);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.argb(180, 0, 0, 0));
        backButton.setBackground(circle);
        int size = dp(44);
        FrameLayout.LayoutParams backParams = new FrameLayout.LayoutParams(size, size);
        backParams.gravity = Gravity.TOP | Gravity.START;
        backParams.setMargins(dp(12), dp(12), 0, 0);
        root.addView(backButton, backParams);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        setContentView(root);
        applySubtitleStyle();
        createPlayer();
        enterImmersiveMode();
    }

    private void createPlayer() {
        if (player != null || videoFile == null) {
            return;
        }
        String path = videoFile.getAbsolutePath();
        Log.d("PlayerActivity", "open path=" + path + " exists=" + new File(path).exists());

        DefaultRenderersFactory renderersFactory =
                new DefaultRenderersFactory(this).setEnableDecoderFallback(true);
        player = new ExoPlayer.Builder(this, renderersFactory).build();
        playerView.setPlayer(player);
        applySubtitleStyle();
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException error) {
                Toast.makeText(PlayerActivity.this, "Can't play this file", Toast.LENGTH_SHORT).show();
                Log.d("PlayerActivity", error.getErrorCodeName() + " " + error.getMessage());
                finish();
            }
        });

        MediaItem item = buildMediaItem();
        restoreLastSelection();
        player.setMediaItem(item);
        player.prepare();
        applySubtitleSelection();
        player.seekTo(savedPosition);
        player.setPlayWhenReady(true);
    }

    private MediaItem buildMediaItem() {
        subtitleEntries.clear();
        if (manifest == null && videoFile != null) {
            manifest = DownloadManifest.load(videoFile.getParentFile());
        }

        MediaItem.Builder builder = new MediaItem.Builder().setUri(Uri.fromFile(videoFile));
        List<MediaItem.SubtitleConfiguration> configurations = new ArrayList<>();

        if (manifest != null && manifest.subtitles != null) {
            for (int i = 0; i < manifest.subtitles.length(); i++) {
                JSONObject entry = manifest.subtitles.optJSONObject(i);
                if (entry == null) continue;

                File subtitleFile = resolveSubtitleFile(entry.optString("file", ""));
                if (subtitleFile == null || !subtitleFile.isFile()) continue;

                String id = entry.optString("id", subtitleFile.getName());
                String lang = entry.optString("lang", "und");
                String label = entry.optString("label", lang);
                String mime = detectSubtitleMime(subtitleFile);
                long offsetMs = entry.optLong("offsetMs", 0);

                File playableFile = subtitleFile;
                if (offsetMs != 0) {
                    try {
                        playableFile = SubtitleShift.shift(
                                this,
                                subtitleFile,
                                offsetMs,
                                MimeTypes.TEXT_VTT.equals(mime)
                        );
                    } catch (Exception shiftError) {
                        Log.w("PlayerActivity", "subtitle shift failed: " + shiftError.getMessage());
                        playableFile = subtitleFile;
                    }
                }

                subtitleEntries.add(new SubtitleEntry(id, lang, label, subtitleFile, mime, offsetMs));
                configurations.add(new MediaItem.SubtitleConfiguration.Builder(Uri.fromFile(playableFile))
                        .setMimeType(mime)
                        .setLanguage(lang)
                        .setLabel(label)
                        .build());
            }
        }

        if (!configurations.isEmpty()) {
            builder.setSubtitleConfigurations(configurations);
        }
        return builder.build();
    }

    private String detectSubtitleMime(File file) {
        String name = file.getName().toLowerCase(Locale.US);
        if (name.endsWith(".vtt")) {
            return MimeTypes.TEXT_VTT;
        }
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[64];
            int read = in.read(buffer);
            if (read > 0) {
                String head = new String(buffer, 0, read, StandardCharsets.UTF_8).trim();
                if (head.startsWith("\uFEFF")) {
                    head = head.substring(1).trim();
                }
                if (head.startsWith("WEBVTT")) {
                    return MimeTypes.TEXT_VTT;
                }
            }
        } catch (Exception ignored) {
        }
        return MimeTypes.APPLICATION_SUBRIP;
    }

    private File resolveSubtitleFile(String relative) {
        if (relative == null || relative.isEmpty()) return null;
        File folder = videoFile.getParentFile();
        if (folder == null) return null;
        try {
            File root = folder.getCanonicalFile();
            File target = new File(root, relative).getCanonicalFile();
            if (!target.getPath().startsWith(root.getPath() + File.separator)) {
                return null;
            }
            return target;
        } catch (Exception e) {
            return null;
        }
    }

    private void restoreLastSelection() {
        selectedSubtitleIndex = -1;
        String saved = prefs().getString(lastLangKey(), null);
        if (saved == null || "off".equals(saved)) return;
        for (int i = 0; i < subtitleEntries.size(); i++) {
            if (saved.equals(subtitleEntries.get(i).lang)) {
                selectedSubtitleIndex = i;
                return;
            }
        }
    }

    private void applySubtitleSelection() {
        if (player == null) return;
        TrackSelectionParameters.Builder builder = player.getTrackSelectionParameters()
                .buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_TEXT);

        if (selectedSubtitleIndex >= 0 && selectedSubtitleIndex < subtitleEntries.size()) {
            SubtitleEntry entry = subtitleEntries.get(selectedSubtitleIndex);
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false);
            builder.setPreferredTextLanguage(entry.lang);
            builder.setSelectUndeterminedTextLanguage(true);
        } else {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
        }
        player.setTrackSelectionParameters(builder.build());
    }

    private void selectSubtitle(int index) {
        selectedSubtitleIndex = index;
        saveCurrentSelection();
        applySubtitleSelection();
    }

    private void saveCurrentSelection() {
        String value = "off";
        if (selectedSubtitleIndex >= 0 && selectedSubtitleIndex < subtitleEntries.size()) {
            value = subtitleEntries.get(selectedSubtitleIndex).lang;
        }
        if ("off".equalsIgnoreCase(value) || "none".equalsIgnoreCase(value)) return;
        prefs().edit().putString(lastLangKey(), value).apply();
    }

    private SubtitleEntry selectedEntry() {
        if (selectedSubtitleIndex >= 0 && selectedSubtitleIndex < subtitleEntries.size()) {
            return subtitleEntries.get(selectedSubtitleIndex);
        }
        return null;
    }

    private View buildSyncRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12), dp(8), dp(12), dp(8));

        SubtitleEntry selected = selectedEntry();

        final TextView offsetView = new TextView(this);
        offsetView.setTextColor(Color.WHITE);
        offsetView.setTextSize(16);
        offsetView.setGravity(Gravity.CENTER);
        offsetView.setText(selected != null ? formatOffset(selected.offsetMs) : "Select a track");

        Button minus = new Button(this);
        minus.setText("-0.5s");
        minus.setAllCaps(false);
        minus.setEnabled(selected != null);

        Button plus = new Button(this);
        plus.setText("+0.5s");
        plus.setAllCaps(false);
        plus.setEnabled(selected != null);

        row.addView(minus);
        row.addView(offsetView, new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(plus);

        minus.setOnClickListener(v -> adjustSubtitleOffset(-500, offsetView));
        plus.setOnClickListener(v -> adjustSubtitleOffset(500, offsetView));
        return row;
    }

    private void adjustSubtitleOffset(long deltaMs, TextView offsetView) {
        SubtitleEntry entry = selectedEntry();
        if (entry == null) return;

        long newOffset = entry.offsetMs + deltaMs;
        entry.offsetMs = newOffset;
        updateManifestOffset(entry.id, newOffset);
        offsetView.setText(formatOffset(newOffset));
        rebuildPlayerAndSelect(entry.id);
    }

    private void updateManifestOffset(String id, long offsetMs) {
        DownloadManifest current = ensureManifest();
        if (current == null || current.subtitles == null) return;

        for (int i = 0; i < current.subtitles.length(); i++) {
            JSONObject entry = current.subtitles.optJSONObject(i);
            if (entry == null || !id.equals(entry.optString("id"))) continue;
            try {
                entry.put("offsetMs", offsetMs);
            } catch (JSONException e) {
                Log.w("PlayerActivity", "subtitle offset save failed: " + e.getMessage());
            }
            break;
        }

        current.updatedAt = System.currentTimeMillis();
        File folder = videoFile != null ? videoFile.getParentFile() : null;
        if (folder != null) {
            current.save(folder);
        }
    }

    private String formatOffset(long offsetMs) {
        if (offsetMs == 0) return "0.0s";
        return String.format(Locale.US, "%+.1fs", offsetMs / 1000.0);
    }

    private void showSubtitleSheet() {
        if (isFinishing()) return;
        if (subtitleSheet != null) {
            subtitleSheet.dismiss();
            subtitleSheet = null;
        }

        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        ScrollView scroll = new ScrollView(this);
        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(16), dp(20), dp(24));
        content.setBackgroundResource(R.drawable.bg_subtitle_sheet);
        scroll.addView(content, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("Subtitles");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setPadding(0, 0, 0, dp(8));
        content.addView(title);

        addSheetRow(content, "Off", "", selectedSubtitleIndex < 0, new Runnable() {
            @Override
            public void run() {
                selectSubtitle(-1);
                dialog.dismiss();
            }
        });

        for (int i = 0; i < subtitleEntries.size(); i++) {
            final int index = i;
            SubtitleEntry entry = subtitleEntries.get(i);
            addSheetRow(content, entry.label, entry.lang, selectedSubtitleIndex == i, new Runnable() {
                @Override
                public void run() {
                    selectSubtitle(index);
                    dialog.dismiss();
                }
            });
        }

        if (!subtitleEntries.isEmpty()) {
            content.addView(sectionTitle("Sync"));
            content.addView(buildSyncRow());

            content.addView(sectionTitle("Text size"));

            String size = currentTextSize();
            addSheetRow(content, "Small", "", "small".equals(size), new Runnable() {
                @Override
                public void run() {
                    setTextSize("small");
                    dialog.dismiss();
                }
            });
            addSheetRow(content, "Medium", "", "medium".equals(size), new Runnable() {
                @Override
                public void run() {
                    setTextSize("medium");
                    dialog.dismiss();
                }
            });
            addSheetRow(content, "Large", "", "large".equals(size), new Runnable() {
                @Override
                public void run() {
                    setTextSize("large");
                    dialog.dismiss();
                }
            });
        }

        content.addView(sectionTitle("Find subtitles"));
        addSheetRow(content, "Search online", "", false, new Runnable() {
            @Override
            public void run() {
                dialog.dismiss();
                searchOnline();
            }
        });
        addSheetRow(content, "Import file", "", false, new Runnable() {
            @Override
            public void run() {
                dialog.dismiss();
                importSubtitle();
            }
        });

        dialog.setContentView(scroll);
        dialog.setOnDismissListener(d -> subtitleSheet = null);
        subtitleSheet = dialog;

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            window.setDimAmount(0.5f);
            window.setGravity(Gravity.BOTTOM);
        }
        dialog.show();

        if (window != null) {
            int sheetHeight = Math.round(getResources().getDisplayMetrics().heightPixels * 0.7f);
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, sheetHeight);
        }
    }

    private void addSheetRow(LinearLayout parent, String title, String subtitle, boolean checked, Runnable action) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12), dp(12), dp(12), dp(12));

        TypedValue out = new TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackground, out, true);
        if (out.resourceId != 0) {
            row.setBackgroundResource(out.resourceId);
        }

        TextView label = new TextView(this);
        String text = title != null ? title : "";
        if (subtitle != null && !subtitle.isEmpty() && !subtitle.equals(title)) {
            text = text + "  ·  " + subtitle;
        }
        label.setText(text);
        label.setTextColor(Color.WHITE);
        label.setTextSize(16);
        row.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView check = new TextView(this);
        check.setText(checked ? "\u2713" : "");
        check.setTextColor(Color.rgb(76, 175, 80));
        check.setTextSize(18);
        row.addView(check);

        row.setOnClickListener(v -> action.run());
        parent.addView(row, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
    }

    private TextView sectionTitle(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.rgb(170, 170, 170));
        view.setTextSize(13);
        view.setPadding(0, dp(16), 0, dp(4));
        return view;
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }

    private String lastLangKey() {
        File folder = videoFile != null ? videoFile.getParentFile() : null;
        return KEY_LAST_LANG_PREFIX + (folder != null ? folder.getName() : "default");
    }

    private String currentTextSize() {
        String value = prefs().getString(KEY_TEXT_SIZE, "medium");
        if ("small".equals(value) || "large".equals(value)) return value;
        return "medium";
    }

    private float subtitleTextSizeSp() {
        String value = currentTextSize();
        if ("small".equals(value)) return 14f;
        if ("large".equals(value)) return 24f;
        return 18f;
    }

    private void setTextSize(String value) {
        prefs().edit().putString(KEY_TEXT_SIZE, value).apply();
        applySubtitleStyle();
    }

    private void applySubtitleStyle() {
        if (playerView == null) return;
        SubtitleView subtitleView = playerView.getSubtitleView();
        if (subtitleView == null) return;

        CaptionStyleCompat style = new CaptionStyleCompat(
                Color.WHITE,
                Color.argb(0xB3, 0, 0, 0),
                Color.TRANSPARENT,
                CaptionStyleCompat.EDGE_TYPE_NONE,
                Color.WHITE,
                null
        );
        subtitleView.setStyle(style);
        subtitleView.setBottomPaddingFraction(0.08f);
        subtitleView.setFixedTextSize(TypedValue.COMPLEX_UNIT_SP, subtitleTextSizeSp());
    }

    private void searchOnline() {
        DownloadManifest current = ensureManifest();
        if (current == null || current.tmdbId == null) {
            Toast.makeText(this, "No TMDB metadata for online search", Toast.LENGTH_SHORT).show();
            return;
        }

        final String lang = currentSearchLang();
        final Integer tmdbId = current.tmdbId;
        final Integer season = current.season;
        final Integer episode = current.episode;

        showProgress("Searching subtitles…");
        new Thread(() -> {
            String url = null;
            try {
                String base = getString(R.string.server_base_url);
                StringBuilder urlBuilder = new StringBuilder(base)
                        .append("/api/subtitles/search?tmdbId=").append(tmdbId)
                        .append("&lang=").append(URLEncoder.encode(lang, "UTF-8"));
                if (season != null && episode != null) {
                    urlBuilder.append("&season=").append(season)
                            .append("&episode=").append(episode);
                }
                url = urlBuilder.toString();

                String json = httpGet(url, "application/json");
                JSONArray array = new JSONArray(json);
                final List<SubtitleResult> results = new ArrayList<>();
                for (int i = 0; i < array.length(); i++) {
                    JSONObject item = array.optJSONObject(i);
                    if (item == null) continue;
                    String fileUrl = item.optString("url", "");
                    if (fileUrl.isEmpty()) continue;
                    String itemLang = item.optString("lang", lang);
                    String itemLabel = item.optString("label", itemLang);
                    results.add(new SubtitleResult(itemLang, itemLabel, fileUrl));
                }

                runOnUiThread(() -> {
                    dismissProgress();
                    if (isFinishing()) return;
                    if (results.isEmpty()) {
                        Toast.makeText(this, "No subtitles found", Toast.LENGTH_SHORT).show();
                    } else {
                        showSearchResults(results);
                    }
                });
            } catch (Exception e) {
                final String failedUrl = url;
                runOnUiThread(() -> {
                    dismissProgress();
                    if (!isFinishing()) {
                        Log.e("TobbiSubs", "search failed url=" + failedUrl + " err=" + e.getMessage());
                        Toast.makeText(this, "Search failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            }
        }).start();
    }

    private String currentSearchLang() {
        String value = null;
        if (selectedSubtitleIndex >= 0 && selectedSubtitleIndex < subtitleEntries.size()) {
            value = subtitleEntries.get(selectedSubtitleIndex).lang;
        }
        value = normalizeSearchLang(value);
        if (value == null) {
            value = normalizeSearchLang(prefs().getString(lastLangKey(), null));
        }
        if (value != null && value.matches("[A-Za-z]{2,5}")) {
            return value.toLowerCase(Locale.US);
        }
        String device = Locale.getDefault().getLanguage();
        if (device != null && device.matches("[A-Za-z]{2,5}")) {
            return device.toLowerCase(Locale.US);
        }
        return "en";
    }

    private String normalizeSearchLang(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        String lower = trimmed.toLowerCase(Locale.US);
        if ("off".equals(lower) || "none".equals(lower)) return null;
        return value;
    }

    private void showSearchResults(final List<SubtitleResult> results) {
        String[] labels = new String[results.size()];
        for (int i = 0; i < results.size(); i++) {
            SubtitleResult result = results.get(i);
            labels[i] = result.label + " (" + result.lang + ")";
        }
        new AlertDialog.Builder(this)
                .setTitle("Search results")
                .setItems(labels, (dialog, which) -> downloadSubtitle(results.get(which)))
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void downloadSubtitle(final SubtitleResult result) {
        if (isFinishing()) return;
        showProgress("Downloading subtitle…");
        new Thread(() -> {
            try {
                String base = getString(R.string.server_base_url);
                String fileUrl = base + "/api/subtitles/file?url="
                        + URLEncoder.encode(result.url, "UTF-8");
                String content = httpGet(fileUrl, "text/plain");
                JSONObject entry = addSubtitleFile(content, result.lang, result.label);
                final String id = entry.optString("id");
                runOnUiThread(() -> {
                    dismissProgress();
                    if (isFinishing()) return;
                    rebuildPlayerAndSelect(id);
                    Toast.makeText(this, "Subtitle added", Toast.LENGTH_SHORT).show();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    dismissProgress();
                    if (!isFinishing()) {
                        Toast.makeText(this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            }
        }).start();
    }

    private void importSubtitle() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                "text/*",
                "application/x-subrip",
                "text/vtt"
        });
        startActivityForResult(intent, REQUEST_IMPORT_SUBTITLE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_IMPORT_SUBTITLE) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;

        final Uri uri = data.getData();
        showProgress("Importing subtitle…");
        new Thread(() -> {
            try {
                String displayName = getDisplayName(uri);
                String content = readText(uri);
                String lang = guessLang(displayName);
                String label = displayLabel(displayName, lang);
                JSONObject entry = addSubtitleFile(content, lang, label);
                final String id = entry.optString("id");
                runOnUiThread(() -> {
                    dismissProgress();
                    if (isFinishing()) return;
                    rebuildPlayerAndSelect(id);
                    Toast.makeText(this, "Subtitle imported", Toast.LENGTH_SHORT).show();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    dismissProgress();
                    if (!isFinishing()) {
                        Toast.makeText(this, "Import failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            }
        }).start();
    }

    private void rebuildPlayerAndSelect(String subtitleId) {
        MediaItem item = buildMediaItem();
        selectedSubtitleIndex = -1;
        for (int i = 0; i < subtitleEntries.size(); i++) {
            if (subtitleEntries.get(i).id.equals(subtitleId)) {
                selectedSubtitleIndex = i;
                break;
            }
        }
        saveCurrentSelection();

        if (player == null) return;

        long position = player.getCurrentPosition();
        if (position < 0) position = savedPosition;
        boolean playWhenReady = player.getPlayWhenReady();

        player.setMediaItem(item, position);
        player.prepare();
        player.setPlayWhenReady(playWhenReady);
        applySubtitleSelection();
    }

    private DownloadManifest ensureManifest() {
        if (manifest == null && videoFile != null) {
            File folder = videoFile.getParentFile();
            manifest = DownloadManifest.load(folder);
            if (manifest == null && folder != null) {
                manifest = new DownloadManifest();
                manifest.id = folder.getName();
                manifest.title = videoFile.getName();
                manifest.status = "done";
                manifest.path = videoFile.getAbsolutePath();
                manifest.size = videoFile.length();
            }
        }
        if (manifest != null && manifest.subtitles == null) {
            manifest.subtitles = new JSONArray();
        }
        return manifest;
    }

    private JSONObject addSubtitleFile(String content, String lang, String label)
            throws JSONException, IOException {
        DownloadManifest current = ensureManifest();
        File folder = videoFile.getParentFile();
        if (current == null || folder == null) {
            throw new IOException("Missing download folder");
        }

        File subsDir = new File(folder, "subs");
        if (!subsDir.exists() && !subsDir.mkdirs()) {
            throw new IOException("Cannot create subtitles folder");
        }

        String safeLang = sanitizeLang(lang);
        if (label == null || label.trim().isEmpty()) {
            label = safeLang;
        }

        int n = nextSubtitleNumber(subsDir, current, safeLang);
        String base = safeLang + "-" + n;
        File target = new File(subsDir, base + ".srt");
        try (FileOutputStream out = new FileOutputStream(target, false)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.flush();
        }

        JSONObject entry = new JSONObject();
        entry.put("id", base);
        entry.put("lang", safeLang);
        entry.put("label", label);
        entry.put("file", "subs/" + base + ".srt");
        entry.put("offsetMs", 0);

        current.subtitles.put(entry);
        current.updatedAt = System.currentTimeMillis();
        current.save(folder);
        return entry;
    }

    private int nextSubtitleNumber(File subsDir, DownloadManifest current, String lang) {
        int n = 1;
        while (true) {
            String base = lang + "-" + n;
            if (!new File(subsDir, base + ".srt").exists() && !hasSubtitleId(current, base)) {
                return n;
            }
            n++;
        }
    }

    private boolean hasSubtitleId(DownloadManifest current, String id) {
        if (current.subtitles == null) return false;
        for (int i = 0; i < current.subtitles.length(); i++) {
            JSONObject entry = current.subtitles.optJSONObject(i);
            if (entry != null && id.equals(entry.optString("id"))) {
                return true;
            }
        }
        return false;
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
            cursor = getContentResolver().query(
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
        InputStream input = getContentResolver().openInputStream(uri);
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

    private String httpGet(String url, String accept) throws IOException {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(NETWORK_TIMEOUT_MS);
            connection.setReadTimeout(NETWORK_TIMEOUT_MS);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", accept);

            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String body = stream != null ? readAll(stream) : "";
            if (code < 200 || code >= 300) {
                throw new IOException("HTTP " + code + ": " + body);
            }
            return body;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readAll(InputStream input) throws IOException {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void showProgress(String message) {
        if (isFinishing()) return;
        dismissProgress();
        progressDialog = ProgressDialog.show(this, null, message, true, false);
    }

    private void dismissProgress() {
        if (progressDialog != null) {
            progressDialog.dismiss();
            progressDialog = null;
        }
    }

    private void enterImmersiveMode() {
        View decorView = getWindow().getDecorView();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(android.view.WindowInsets.Type.statusBars()
                        | android.view.WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        createPlayer();
        enterImmersiveMode();
    }

    @Override
    protected void onStop() {
        dismissProgress();
        if (subtitleSheet != null) {
            subtitleSheet.dismiss();
            subtitleSheet = null;
        }
        if (player != null) {
            savedPosition = player.getCurrentPosition();
            player.release();
            player = null;
            playerView.setPlayer(null);
        }
        super.onStop();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (player != null) {
            savedPosition = player.getCurrentPosition();
        }
        outState.putLong(STATE_POSITION, savedPosition);
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
