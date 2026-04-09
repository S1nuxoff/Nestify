package com.nestify.nestifyplayer

import android.content.Context
import org.json.JSONObject

object AmbientConfig {
    var enabled: Boolean = false
    var wledIp: String = "192.168.0.221"

    // як часто оновлювати колір, мс
    var updateIntervalMs: Long = 200L

    // поріг яскравості для чорних полос (0–255)
    var blackBarLumaThreshold: Int = 16

    private const val PREFS = "ambient_config"
    private const val KEY = "ambient_json"

    fun load(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY, null) ?: return
        try {
            val o = JSONObject(json)
            enabled = o.optBoolean("enabled", enabled)
            wledIp = o.optString("wledIp", wledIp)
            updateIntervalMs = o.optLong("updateIntervalMs", updateIntervalMs)
            blackBarLumaThreshold = o.optInt("blackBarLumaThreshold", blackBarLumaThreshold)
        } catch (_: Exception) {
        }
    }

    fun save(context: Context) {
        val o = JSONObject()
            .put("enabled", enabled)
            .put("wledIp", wledIp)
            .put("updateIntervalMs", updateIntervalMs)
            .put("blackBarLumaThreshold", blackBarLumaThreshold)

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY, o.toString()).apply()
    }
}
