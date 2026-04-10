package com.nestify.nestifyplayer

import android.content.Context
import android.content.SharedPreferences
import android.os.Build

/**
 * Persists TV auth session between app launches.
 */
object TvSession {

    private const val PREFS = "nestify_tv_session"
    private const val KEY_AUTH_TOKEN  = "auth_token"
    private const val KEY_ACCOUNT_ID  = "account_id"
    private const val KEY_PROFILE_ID  = "profile_id"
    private const val KEY_PROFILE_NAME = "profile_name"
    private const val KEY_PROFILE_AVATAR = "profile_avatar"
    private const val KEY_DEVICE_NAME = "device_name"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(
        ctx: Context,
        authToken: String,
        accountId: Int,
        profileId: Int,
        profileName: String,
        profileAvatar: String?,
        deviceName: String,
    ) {
        prefs(ctx).edit()
            .putString(KEY_AUTH_TOKEN, authToken)
            .putInt(KEY_ACCOUNT_ID, accountId)
            .putInt(KEY_PROFILE_ID, profileId)
            .putString(KEY_PROFILE_NAME, profileName)
            .putString(KEY_PROFILE_AVATAR, profileAvatar ?: "")
            .putString(KEY_DEVICE_NAME, deviceName)
            .apply()
    }

    fun clear(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_ACCOUNT_ID)
            .remove(KEY_PROFILE_ID)
            .remove(KEY_PROFILE_NAME)
            .remove(KEY_PROFILE_AVATAR)
            .apply()
    }

    fun getAuthToken(ctx: Context): String? =
        prefs(ctx).getString(KEY_AUTH_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun getAccountId(ctx: Context): Int =
        prefs(ctx).getInt(KEY_ACCOUNT_ID, -1)

    fun getProfileId(ctx: Context): Int =
        prefs(ctx).getInt(KEY_PROFILE_ID, -1)

    fun getProfileName(ctx: Context): String =
        prefs(ctx).getString(KEY_PROFILE_NAME, "") ?: ""

    fun getProfileAvatar(ctx: Context): String? =
        prefs(ctx).getString(KEY_PROFILE_AVATAR, "")?.takeIf { it.isNotBlank() }

    fun getDeviceName(ctx: Context): String =
        prefs(ctx).getString(KEY_DEVICE_NAME, null)
            ?.takeIf { it.isNotBlank() }
            ?: buildDefaultDeviceName().also { name ->
                prefs(ctx).edit().putString(KEY_DEVICE_NAME, name).apply()
            }

    fun isLoggedIn(ctx: Context): Boolean = getAuthToken(ctx) != null

    private fun buildDefaultDeviceName(): String {
        val manufacturer = Build.MANUFACTURER.orEmpty().trim()
        val model = Build.MODEL.orEmpty().trim()
        if (manufacturer.isBlank() && model.isBlank()) return "Android TV"
        if (model.startsWith(manufacturer, ignoreCase = true)) {
            return model.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        }
        return listOf(manufacturer, model)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}
