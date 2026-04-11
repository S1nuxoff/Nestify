package com.nestify.tvshell;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

final class TvApiClient {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build();

    private TvApiClient() {
    }

    static JSONObject login(String baseUrl, String email, String password, String deviceId, String deviceName) throws Exception {
        JSONObject body = new JSONObject()
            .put("email", email)
            .put("password", password)
            .put("device_id", deviceId)
            .put("device_name", deviceName);
        return postJson(baseUrl + "/api/v3/tv/login", null, body);
    }

    static JSONObject qrCreate(String baseUrl, String deviceId, String deviceName) throws Exception {
        JSONObject body = new JSONObject()
            .put("device_id", deviceId)
            .put("device_name", deviceName);
        return postJson(baseUrl + "/api/v3/tv/qr/create", null, body);
    }

    static JSONObject qrPoll(String baseUrl, String token) throws Exception {
        return getJson(baseUrl + "/api/v3/tv/qr/poll/" + token, null);
    }

    static JSONObject registerDevice(String baseUrl, String authToken, String deviceId, int profileId, String deviceName) throws Exception {
        JSONObject body = new JSONObject()
            .put("device_id", deviceId)
            .put("profile_id", profileId)
            .put("device_name", deviceName);
        return postJson(baseUrl + "/api/v3/tv/register", authToken, body);
    }

    static JSONObject logoutDevice(String baseUrl, String authToken, String deviceId) throws Exception {
        JSONObject body = new JSONObject().put("device_id", deviceId);
        return postJson(baseUrl + "/api/v3/tv/logout", authToken, body);
    }

    static boolean validateToken(String baseUrl, String authToken) {
        Request.Builder builder = new Request.Builder().url(baseUrl + "/api/v1/auth/me");
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }
        try (Response response = HTTP.newCall(builder.get().build()).execute()) {
            return response.isSuccessful();
        } catch (IOException e) {
            return false;
        }
    }

    private static JSONObject getJson(String url, String authToken) throws Exception {
        Request.Builder builder = new Request.Builder().url(url).get();
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }
        try (Response response = HTTP.newCall(builder.build()).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("HTTP " + response.code());
            }
            String raw = response.body() != null ? response.body().string() : "{}";
            return new JSONObject(raw);
        }
    }

    private static JSONObject postJson(String url, String authToken, JSONObject body) throws Exception {
        RequestBody requestBody = RequestBody.create(body.toString(), JSON);
        Request.Builder builder = new Request.Builder().url(url).post(requestBody);
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }
        try (Response response = HTTP.newCall(builder.build()).execute()) {
            String raw = response.body() != null ? response.body().string() : "{}";
            if (!response.isSuccessful()) {
                String detail = raw;
                try {
                    detail = new JSONObject(raw).optString("detail", raw);
                } catch (Exception ignored) {
                }
                throw new IOException(detail);
            }
            return raw.isEmpty() ? new JSONObject().put("ok", true) : new JSONObject(raw);
        }
    }
}
