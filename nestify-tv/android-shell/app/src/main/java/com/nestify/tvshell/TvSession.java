package com.nestify.tvshell;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class TvSession {
    private static final String PREFS = "nestify_tv_shell_session";
    private static final String KEY_AUTH_TOKEN = "auth_token";
    private static final String KEY_ACCOUNT_ID = "account_id";
    private static final String KEY_ACCOUNT_EMAIL = "account_email";
    private static final String KEY_ACCOUNT_DISPLAY_NAME = "account_display_name";
    private static final String KEY_PROFILE_ID = "profile_id";
    private static final String KEY_PROFILE_NAME = "profile_name";
    private static final String KEY_PROFILE_AVATAR = "profile_avatar";
    private static final String KEY_PROFILES_JSON = "profiles_json";
    private static final String KEY_DEVICE_NAME = "device_name";

    private TvSession() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveAccountSession(
        Context context,
        String authToken,
        int accountId,
        String accountEmail,
        String displayName,
        JSONArray profiles
    ) {
        prefs(context).edit()
            .putString(KEY_AUTH_TOKEN, authToken)
            .putInt(KEY_ACCOUNT_ID, accountId)
            .putString(KEY_ACCOUNT_EMAIL, accountEmail != null ? accountEmail : "")
            .putString(KEY_ACCOUNT_DISPLAY_NAME, displayName != null ? displayName : "")
            .putString(KEY_PROFILES_JSON, profiles != null ? profiles.toString() : "[]")
            .remove(KEY_PROFILE_ID)
            .remove(KEY_PROFILE_NAME)
            .remove(KEY_PROFILE_AVATAR)
            .apply();
    }

    static void activateProfile(Context context, int profileId, String profileName, String profileAvatar) {
        prefs(context).edit()
            .putInt(KEY_PROFILE_ID, profileId)
            .putString(KEY_PROFILE_NAME, profileName != null ? profileName : "")
            .putString(KEY_PROFILE_AVATAR, profileAvatar != null ? profileAvatar : "")
            .apply();
    }

    static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }

    static String getAuthToken(Context context) {
        String token = prefs(context).getString(KEY_AUTH_TOKEN, null);
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return token;
    }

    static boolean hasAccountSession(Context context) {
        return getAuthToken(context) != null && getAccountId(context) > 0;
    }

    static boolean hasSelectedProfile(Context context) {
        return getProfileId(context) > 0;
    }

    static int getAccountId(Context context) {
        return prefs(context).getInt(KEY_ACCOUNT_ID, -1);
    }

    static int getProfileId(Context context) {
        return prefs(context).getInt(KEY_PROFILE_ID, -1);
    }

    static String getProfileName(Context context) {
        return prefs(context).getString(KEY_PROFILE_NAME, "") == null
            ? ""
            : prefs(context).getString(KEY_PROFILE_NAME, "");
    }

    static String getProfileAvatar(Context context) {
        return prefs(context).getString(KEY_PROFILE_AVATAR, "");
    }

    static String getDeviceName(Context context) {
        String existing = prefs(context).getString(KEY_DEVICE_NAME, null);
        if (existing != null && !existing.trim().isEmpty()) {
            return existing;
        }
        String generated = buildDefaultDeviceName();
        prefs(context).edit().putString(KEY_DEVICE_NAME, generated).apply();
        return generated;
    }

    private static String buildDefaultDeviceName() {
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.trim();
        String model = Build.MODEL == null ? "" : Build.MODEL.trim();
        if (manufacturer.isEmpty() && model.isEmpty()) {
            return "Android TV";
        }
        if (!manufacturer.isEmpty() && model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
            return capitalize(model);
        }
        String combined = (manufacturer + " " + model).trim();
        return capitalize(combined);
    }

    private static String capitalize(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value.substring(0, 1).toUpperCase() + value.substring(1);
    }

    static JSONArray getProfiles(Context context) {
        String raw = prefs(context).getString(KEY_PROFILES_JSON, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static JSONObject buildBootstrapPayload(Context context, String deviceId) {
        JSONObject obj = new JSONObject();
        try {
            obj.put("device_id", deviceId);
            obj.put("device_name", getDeviceName(context));
            obj.put("has_account_session", hasAccountSession(context));
            obj.put("has_selected_profile", hasSelectedProfile(context));
            obj.put("auth_token", getAuthToken(context));
            obj.put("profiles", getProfiles(context));

            if (hasAccountSession(context)) {
                JSONObject account = new JSONObject();
                account.put("id", getAccountId(context));
                account.put("email", prefs(context).getString(KEY_ACCOUNT_EMAIL, ""));
                account.put("display_name", prefs(context).getString(KEY_ACCOUNT_DISPLAY_NAME, ""));
                obj.put("account", account);
            } else {
                obj.put("account", JSONObject.NULL);
            }

            if (hasSelectedProfile(context)) {
                JSONObject profile = new JSONObject();
                profile.put("id", getProfileId(context));
                profile.put("name", getProfileName(context));
                profile.put("avatar_url", getProfileAvatar(context));
                obj.put("profile", profile);
            } else {
                obj.put("profile", JSONObject.NULL);
            }
        } catch (JSONException ignored) {
        }
        return obj;
    }
}
