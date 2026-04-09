package com.nestify.nestifyplayer

import android.content.Context
import java.security.SecureRandom

object DeviceId {

    private const val PREFS_NAME = "nestify_player_prefs"
    private const val KEY_DEVICE_ID = "device_id"

    // Без схожих символів: 0/O, 1/I і т.п.
    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private const val LENGTH = 8

    private val random = SecureRandom()

    fun get(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_DEVICE_ID, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }

        val newId = generateCode()
        prefs.edit().putString(KEY_DEVICE_ID, newId).apply()
        return newId
    }

    private fun generateCode(): String {
        val sb = StringBuilder(LENGTH)
        repeat(LENGTH) {
            val idx = random.nextInt(ALPHABET.length)
            sb.append(ALPHABET[idx])
        }
        return sb.toString()  // типу "7K4Z9Q2B"
    }
}
