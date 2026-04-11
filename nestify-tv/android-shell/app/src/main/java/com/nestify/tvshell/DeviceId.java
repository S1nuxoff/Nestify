package com.nestify.tvshell;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.UUID;

final class DeviceId {
    private static final String PREFS = "nestify_tv_shell_device";
    private static final String KEY_DEVICE_ID = "device_id";

    private DeviceId() {
    }

    static String get(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String existing = prefs.getString(KEY_DEVICE_ID, null);
        if (existing != null && !existing.trim().isEmpty()) {
            return existing;
        }

        String generated = UUID.randomUUID().toString().replace("-", "");
        prefs.edit().putString(KEY_DEVICE_ID, generated).apply();
        return generated;
    }
}
