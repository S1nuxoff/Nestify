package com.nestify.tvshell;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

final class ProgressReporter {
    private static final long INTERVAL_MS = 5000L;
    private static final long MIN_DELTA_MS = 3000L;

    private static long lastSentPosMs = -1L;
    private static Thread thread;
    private static volatile boolean running = false;

    private ProgressReporter() {
    }

    interface StatusProvider {
        JSONObject getStatus();
    }

    static synchronized void start(StatusProvider provider) {
        if (running) {
            return;
        }
        running = true;
        thread = new Thread(() -> {
            while (running) {
                try {
                    sendProgress(provider.getStatus(), false);
                    Thread.sleep(INTERVAL_MS);
                } catch (InterruptedException e) {
                    break;
                } catch (Exception ignored) {
                }
            }
        });
        thread.setDaemon(true);
        thread.start();
    }

    static synchronized void stop() {
        running = false;
        if (thread != null) {
            thread.interrupt();
            thread = null;
        }
        lastSentPosMs = -1L;
    }

    static void reportImmediate(JSONObject status) {
        sendProgress(status, true);
    }

    static void syncPosition(long positionMs) {
        lastSentPosMs = positionMs;
    }

    private static void sendProgress(JSONObject st, boolean force) {
        if (st == null) {
            return;
        }

        int userId = parseInt(st.opt("user_id"));
        if (userId <= 0) {
            return;
        }

        String movieId = st.optString("movie_id", "");
        if (movieId.isBlank()) {
            return;
        }

        long durationMs = st.optLong("duration_ms", 0L);
        if (durationMs <= 0) {
            return;
        }

        boolean isPlaying = st.optBoolean("is_playing", false);
        long positionMs = st.optLong("position_ms", 0L);

        if (!force && !isPlaying) {
            return;
        }

        if (!force && lastSentPosMs >= 0 && Math.abs(positionMs - lastSentPosMs) < MIN_DELTA_MS) {
            return;
        }

        HttpURLConnection conn = null;
        try {
            URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/api/v3/watch/progress");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            JSONObject body = new JSONObject()
                .put("user_id", userId)
                .put("movie_id", movieId)
                .put("position_seconds", positionMs / 1000)
                .put("duration", durationMs / 1000)
                .put("season", st.has("season") ? st.opt("season") : JSONObject.NULL)
                .put("episode", st.has("episode") ? st.opt("episode") : JSONObject.NULL)
                .put("torrent_hash", optOrNull(st, "torrent_hash"))
                .put("torrent_file_id", st.has("torrent_file_id") ? st.opt("torrent_file_id") : JSONObject.NULL)
                .put("torrent_fname", optOrNull(st, "torrent_fname"))
                .put("torrent_magnet", optOrNull(st, "torrent_magnet"));

            byte[] bytes = body.toString().getBytes();
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
                os.flush();
            }

            conn.getResponseCode();
            lastSentPosMs = positionMs;
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static Object optOrNull(JSONObject obj, String key) {
        if (!obj.has(key) || obj.isNull(key)) {
            return JSONObject.NULL;
        }
        String value = obj.optString(key, "");
        return value.isBlank() ? JSONObject.NULL : value;
    }

    private static int parseInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text);
            } catch (Exception ignored) {
                return -1;
            }
        }
        return -1;
    }
}
