package com.tobbihub.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.BufferedReader;
import java.io.IOException;

public class DownloadManifest {
    public String id;
    public String title;
    public Integer tmdbId;
    public Integer season;
    public Integer episode;
    public String poster;
    public String label;
    public String status;
    public int segTotal = 0;
    public int segDone = 0;
    public int audioSegTotal = 0;
    public int audioSegDone = 0;
    public long bytesDone = 0;
    public long estBytes = -1;
    public String container;
    public boolean hasAudio = false;
    public long createdAt = 0;
    public long updatedAt = 0;
    public String errorCode = null;
    public String error;
    public String path;
    public long size = 0;
    public String initUrl;
    public JSONArray subtitles = new JSONArray();

    public static DownloadManifest load(File dir) {
        File file = new File(dir, "manifest.json");
        if (!file.exists()) {
            return null;
        }
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            JSONObject json = new JSONObject(sb.toString());
            return fromJson(json);
        } catch (Exception e) {
            return null;
        }
    }

    public void save(File dir) {
        File tmp = new File(dir, "manifest.tmp");
        File file = new File(dir, "manifest.json");
        try (FileWriter writer = new FileWriter(tmp)) {
            writer.write(toJson().toString());
            writer.flush();
        } catch (IOException e) {
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(file)) {
            tmp.delete();
        }
    }

    public JSONObject toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("id", id);
            json.put("title", title);
            if (tmdbId != null) {
                json.put("tmdbId", tmdbId.intValue());
            }
            if (season != null) {
                json.put("season", season.intValue());
            }
            if (episode != null) {
                json.put("episode", episode.intValue());
            }
            json.put("poster", poster);
            json.put("label", label);
            json.put("status", status);
            json.put("segTotal", segTotal);
            json.put("segDone", segDone);
            json.put("audioSegTotal", audioSegTotal);
            json.put("audioSegDone", audioSegDone);
            json.put("bytesDone", bytesDone);
            json.put("estBytes", estBytes);
            json.put("container", container);
            json.put("hasAudio", hasAudio);
            json.put("createdAt", createdAt);
            json.put("updatedAt", updatedAt);
            json.put("errorCode", errorCode);
            json.put("error", error);
            json.put("path", path);
            json.put("size", size);
            json.put("initUrl", initUrl);
            json.put("subtitles", subtitles != null ? subtitles : new JSONArray());
        } catch (JSONException ignored) {}
        return json;
    }

    public static DownloadManifest fromJson(JSONObject json) {
        DownloadManifest m = new DownloadManifest();
        m.id = json.optString("id", "");
        m.title = json.optString("title", "");
        if (json.has("tmdbId") && !json.isNull("tmdbId")) {
            m.tmdbId = json.optInt("tmdbId");
        }
        if (json.has("season") && !json.isNull("season")) {
            m.season = json.optInt("season");
        }
        if (json.has("episode") && !json.isNull("episode")) {
            m.episode = json.optInt("episode");
        }
        m.poster = json.optString("poster", "");
        m.label = json.optString("label", "");
        m.status = json.optString("status", "queued");
        m.segTotal = json.optInt("segTotal", 0);
        m.segDone = json.optInt("segDone", 0);
        m.audioSegTotal = json.optInt("audioSegTotal", 0);
        m.audioSegDone = json.optInt("audioSegDone", 0);
        m.bytesDone = json.optLong("bytesDone", 0);
        m.estBytes = json.optLong("estBytes", -1);
        m.container = json.optString("container", "");
        m.hasAudio = json.optBoolean("hasAudio", false);
        m.createdAt = json.optLong("createdAt", 0);
        m.updatedAt = json.optLong("updatedAt", 0);
        m.errorCode = json.optString("errorCode", null);
        m.error = json.optString("error", "");
        m.path = json.optString("path", "");
        m.size = json.optLong("size", 0);
        JSONArray loadedSubtitles = json.optJSONArray("subtitles");
        m.subtitles = loadedSubtitles != null ? loadedSubtitles : new JSONArray();
        return m;
    }
}