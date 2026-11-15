package com.tobbihub.app;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

public class PlaylistParser {

    public static class Parsed {
        public String initUrl;
        public List<String> segmentUrls = new ArrayList<>();
        public double totalDuration = 0;
        public boolean endList = false;
        public String keyMethod = "NONE";
        public boolean hasByteRange = false;
        public String container = "ts";
    }

    public static Parsed parseMedia(String body, String baseUrl) {
        Parsed result = new Parsed();
        if (body == null) {
            return result;
        }

        URI baseUri;
        try {
            baseUri = new URI(baseUrl);
        } catch (URISyntaxException e) {
            baseUri = null;
        }

        String[] lines = body.split("\\r?\\n");
        String pendingDuration = null;

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();

            if (line.isEmpty() || !line.startsWith("#")) {
                if (pendingDuration != null) {
                    String segmentUrl = resolveUrl(baseUri, line);
                    if (segmentUrl != null) {
                        result.segmentUrls.add(segmentUrl);
                    }
                    pendingDuration = null;
                }
                continue;
            }

            if (line.startsWith("#EXT-X-MAP:")) {
                String uri = extractAttribute(line, "URI");
                if (uri != null) {
                    result.initUrl = resolveUrl(baseUri, uri);
                }
            } else if (line.startsWith("#EXTINF:")) {
                String durationStr = line.substring(8).split(",")[0].trim();
                try {
                    pendingDuration = durationStr;
                    result.totalDuration += Double.parseDouble(durationStr);
                } catch (NumberFormatException ignored) {
                    pendingDuration = null;
                }
            } else if (line.startsWith("#EXT-X-KEY:")) {
                String method = extractAttribute(line, "METHOD");
                if (method != null) {
                    result.keyMethod = method;
                }
            } else if (line.startsWith("#EXT-X-ENDLIST")) {
                result.endList = true;
            } else if (line.startsWith("#EXT-X-BYTERANGE")) {
                result.hasByteRange = true;
            }
        }

        return result;
    }

    private static String extractAttribute(String line, String name) {
        String pattern = name + "=\"([^\"]+)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern, java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher m = p.matcher(line);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }

    private static String resolveUrl(URI baseUri, String url) {
        if (url == null || url.isEmpty()) {
            return null;
        }
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
            return url;
        }
        if (baseUri == null) {
            return url;
        }
        try {
            return baseUri.resolve(url).toString();
        } catch (Exception e) {
            return url;
        }
    }
}