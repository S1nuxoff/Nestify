package com.nestify.tvshell;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;

import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

final class PlayerWsClient {
    interface Listener {
        void onPlayUrl(JSONObject params);
        void onPlayPause();
        void onStop();
        void onSeek(long positionMs);
        void onSetVolume(int volume);
        JSONObject getStatus();
    }

    private final String baseUrl;
    private final String deviceId;
    private final Listener listener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final OkHttpClient client = new OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build();

    private WebSocket socket;
    private boolean shouldReconnect = true;
    private boolean reconnectScheduled = false;

    PlayerWsClient(String baseUrl, String deviceId, Listener listener) {
        this.baseUrl = baseUrl;
        this.deviceId = deviceId;
        this.listener = listener;
    }

    void connect() {
        shouldReconnect = true;
        if (socket != null) {
            return;
        }

        Request request = new Request.Builder()
            .url(baseUrl.replaceAll("/+$", "") + "/ws/player/" + deviceId)
            .build();

        socket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                sendNotification("Player.OnConnect", listener.getStatus());
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                handleIncoming(text);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                socket = null;
                if (shouldReconnect && code != 4403 && code != 4404) {
                    scheduleReconnect();
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, @Nullable Response response) {
                socket = null;
                if (shouldReconnect) {
                    scheduleReconnect();
                }
            }
        });
    }

    void close() {
        shouldReconnect = false;
        reconnectScheduled = false;
        mainHandler.removeCallbacksAndMessages(null);
        if (socket != null) {
            socket.close(1000, "closed");
            socket = null;
        }
    }

    void sendNotification(String method, JSONObject data) {
        try {
            JSONObject obj = new JSONObject()
                .put("jsonrpc", "2.0")
                .put("method", method)
                .put("params", new JSONObject().put("data", data));
            if (socket != null) {
                socket.send(obj.toString());
            }
        } catch (Exception ignored) {
        }
    }

    private void scheduleReconnect() {
        if (reconnectScheduled) {
            return;
        }
        reconnectScheduled = true;
        mainHandler.postDelayed(() -> {
            reconnectScheduled = false;
            connect();
        }, 5000L);
    }

    private void handleIncoming(String raw) {
        try {
            JSONObject obj = new JSONObject(raw);
            Object id = obj.has("id") ? obj.get("id") : null;
            String method = obj.optString("method", "");
            JSONObject params = obj.optJSONObject("params");
            if (params == null) {
                params = new JSONObject();
            }

            switch (method) {
                case "Player.PlayUrl":
                    listener.onPlayUrl(params);
                    respondOk(id);
                    break;
                case "Player.PlayPause":
                    listener.onPlayPause();
                    respondOk(id);
                    break;
                case "Player.Stop":
                    listener.onStop();
                    respondOk(id);
                    break;
                case "Player.Seek":
                    listener.onSeek(params.optLong("position_ms", 0L));
                    respondOk(id);
                    break;
                case "Application.SetVolume":
                    listener.onSetVolume(params.optInt("volume", 100));
                    respondOk(id);
                    break;
                case "Player.GetStatus":
                    respondResult(id, listener.getStatus());
                    break;
                default:
                    if (id != null) {
                        respondOk(id);
                    }
                    break;
            }
        } catch (Exception ignored) {
        }
    }

    private void respondOk(Object id) {
        if (id == null || socket == null) {
            return;
        }
        try {
            JSONObject obj = new JSONObject()
                .put("jsonrpc", "2.0")
                .put("id", id)
                .put("result", new JSONObject().put("ok", true));
            socket.send(obj.toString());
        } catch (Exception ignored) {
        }
    }

    private void respondResult(Object id, JSONObject result) {
        if (id == null || socket == null) {
            return;
        }
        try {
            JSONObject obj = new JSONObject()
                .put("jsonrpc", "2.0")
                .put("id", id)
                .put("result", result != null ? result : new JSONObject());
            socket.send(obj.toString());
        } catch (Exception ignored) {
        }
    }
}
