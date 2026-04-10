package com.nestify.nestifyplayer

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object TvApiClient {

    private val TAG = "TvApiClient"
    private val JSON_MT = "application/json; charset=utf-8".toMediaType()

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    // ── Login with email/password ─────────────────────────────────────────────

    data class LoginResult(
        val authToken: String,
        val accountId: Int,
        val displayName: String,
        val profiles: List<ProfileInfo>,
    )

    data class ProfileInfo(
        val id: Int,
        val name: String,
        val avatarUrl: String?,
    )

    data class TorrentCandidate(
        val title: String,
        val magnet: String,
        val size: Long,
        val seeders: Int,
        val peers: Int,
        val tracker: String,
        val quality: String?,
        val videotype: String,
        val lang: String,
    )

    data class StreamFile(
        val name: String,
        val size: Long,
        val fileId: Int,
        val streamUrl: String,
    )

    data class AddTorrentResult(
        val hash: String,
        val files: List<StreamFile>,
    )

    suspend fun login(baseUrl: String, email: String, password: String, deviceId: String, deviceName: String): LoginResult? =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject()
                    .put("email", email)
                    .put("password", password)
                    .put("device_id", deviceId)
                    .put("device_name", deviceName)
                    .toString().toRequestBody(JSON_MT)

                val resp = http.newCall(
                    Request.Builder().url("$baseUrl/api/v3/tv/login").post(body).build()
                ).execute()

                if (!resp.isSuccessful) {
                    Log.w(TAG, "login failed: ${resp.code}")
                    return@withContext null
                }

                val json = JSONObject(resp.body!!.string())
                val profiles = parseProfiles(json.optJSONArray("profiles"))
                val acc = json.getJSONObject("account")

                LoginResult(
                    authToken = json.getString("auth_token"),
                    accountId = acc.getInt("id"),
                    displayName = acc.optString("display_name", ""),
                    profiles = profiles,
                )
            } catch (e: Exception) {
                Log.e(TAG, "login error", e)
                null
            }
        }

    // ── QR create ─────────────────────────────────────────────────────────────

    data class QrToken(val token: String, val qrUrl: String, val expiresIn: Int)

    suspend fun qrCreate(baseUrl: String, deviceId: String, deviceName: String): QrToken? =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject()
                    .put("device_id", deviceId)
                    .put("device_name", deviceName)
                    .toString().toRequestBody(JSON_MT)

                val resp = http.newCall(
                    Request.Builder().url("$baseUrl/api/v3/tv/qr/create").post(body).build()
                ).execute()

                if (!resp.isSuccessful) return@withContext null
                val json = JSONObject(resp.body!!.string())
                QrToken(
                    token = json.getString("token"),
                    qrUrl = json.getString("qr_url"),
                    expiresIn = json.optInt("expires_in", 300),
                )
            } catch (e: Exception) {
                Log.e(TAG, "qrCreate error", e)
                null
            }
        }

    // ── QR poll ───────────────────────────────────────────────────────────────

    data class QrPollResult(
        val confirmed: Boolean,
        val expired: Boolean = false,
        val authToken: String? = null,
        val accountId: Int = -1,
        val profiles: List<ProfileInfo> = emptyList(),
    )

    suspend fun qrPoll(baseUrl: String, token: String): QrPollResult =
        withContext(Dispatchers.IO) {
            try {
                val resp = http.newCall(
                    Request.Builder().url("$baseUrl/api/v3/tv/qr/poll/$token").get().build()
                ).execute()

                if (!resp.isSuccessful) return@withContext QrPollResult(confirmed = false)
                val json = JSONObject(resp.body!!.string())

                val confirmed = json.optBoolean("confirmed", false)
                val expired = json.optBoolean("expired", false)

                if (!confirmed) return@withContext QrPollResult(confirmed = false, expired = expired)

                val acc = json.getJSONObject("account")
                QrPollResult(
                    confirmed = true,
                    authToken = json.getString("auth_token"),
                    accountId = acc.getInt("id"),
                    profiles = parseProfiles(json.optJSONArray("profiles")),
                )
            } catch (e: Exception) {
                Log.e(TAG, "qrPoll error", e)
                QrPollResult(confirmed = false)
            }
        }

    // ── Register device ───────────────────────────────────────────────────────

    suspend fun registerDevice(
        baseUrl: String,
        authToken: String,
        deviceId: String,
        profileId: Int,
        deviceName: String,
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject()
                .put("device_id", deviceId)
                .put("profile_id", profileId)
                .put("device_name", deviceName)
                .toString().toRequestBody(JSON_MT)

            val resp = http.newCall(
                Request.Builder()
                    .url("$baseUrl/api/v3/tv/register")
                    .header("Authorization", "Bearer $authToken")
                    .post(body)
                    .build()
            ).execute()

            resp.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "registerDevice error", e)
            false
        }
    }

    suspend fun logoutDevice(
        baseUrl: String,
        authToken: String,
        deviceId: String,
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject()
                .put("device_id", deviceId)
                .toString().toRequestBody(JSON_MT)

            val resp = http.newCall(
                Request.Builder()
                    .url("$baseUrl/api/v3/tv/logout")
                    .header("Authorization", "Bearer $authToken")
                    .post(body)
                    .build()
            ).execute()

            resp.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "logoutDevice error", e)
            false
        }
    }

    // ── Validate token ────────────────────────────────────────────────────────

    suspend fun validateToken(baseUrl: String, authToken: String): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val resp = http.newCall(
                    Request.Builder()
                        .url("$baseUrl/api/v1/auth/me")
                        .header("Authorization", "Bearer $authToken")
                        .get()
                        .build()
                ).execute()
                resp.isSuccessful
            } catch (e: Exception) {
                false
            }
        }

    // ── Fetch profiles for authenticated account ──────────────────────────────

    suspend fun fetchProfiles(baseUrl: String, authToken: String): List<ProfileInfo> =
        withContext(Dispatchers.IO) {
            try {
                val resp = http.newCall(
                    Request.Builder()
                        .url("$baseUrl/api/v3/tv/profiles")
                        .header("Authorization", "Bearer $authToken")
                        .get()
                        .build()
                ).execute()
                if (!resp.isSuccessful) return@withContext emptyList()
                parseProfiles(org.json.JSONArray(resp.body!!.string()))
            } catch (e: Exception) {
                Log.e(TAG, "fetchProfiles error", e)
                emptyList()
            }
        }

    suspend fun searchTorrents(
        baseUrl: String,
        title: String,
        year: String,
        tmdbId: Int,
        mediaType: String,
    ): List<TorrentCandidate> = withContext(Dispatchers.IO) {
        try {
            val url = "${baseUrl}/api/v3/stream/search".toHttpUrl().newBuilder()
                .addQueryParameter("q", title)
                .addQueryParameter("title", title)
                .addQueryParameter("tmdb_id", tmdbId.toString())
                .addQueryParameter("media_type", mediaType)
                .apply {
                    if (year.isNotBlank()) addQueryParameter("year", year)
                }
                .build()

            val resp = http.newCall(Request.Builder().url(url).get().build()).execute()
            if (!resp.isSuccessful) return@withContext emptyList()

            val json = JSONObject(resp.body!!.string())
            buildList {
                addAll(parseTorrentLang(json.optJSONArray("uk"), "uk"))
                addAll(parseTorrentLang(json.optJSONArray("en"), "en"))
                addAll(parseTorrentLang(json.optJSONArray("pl"), "pl"))
                addAll(parseTorrentLang(json.optJSONArray("ru"), "ru"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "searchTorrents error", e)
            emptyList()
        }
    }

    suspend fun addTorrent(
        baseUrl: String,
        magnet: String,
        title: String,
        poster: String,
    ): AddTorrentResult? = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject()
                .put("magnet", magnet)
                .put("title", title)
                .put("poster", poster)
                .toString().toRequestBody(JSON_MT)

            val resp = http.newCall(
                Request.Builder().url("$baseUrl/api/v3/stream/add").post(body).build()
            ).execute()
            if (!resp.isSuccessful) return@withContext null

            val json = JSONObject(resp.body!!.string())
            val filesArr = json.optJSONArray("files") ?: JSONArray()
            val files = (0 until filesArr.length()).map { i ->
                val obj = filesArr.getJSONObject(i)
                StreamFile(
                    name = obj.optString("name", ""),
                    size = obj.optLong("size", 0L),
                    fileId = obj.optInt("file_id", i + 1),
                    streamUrl = obj.optString("stream_url", ""),
                )
            }.filter { it.streamUrl.isNotBlank() }

            AddTorrentResult(
                hash = json.optString("hash", ""),
                files = files,
            )
        } catch (e: Exception) {
            Log.e(TAG, "addTorrent error", e)
            null
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun parseProfiles(arr: JSONArray?): List<ProfileInfo> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            ProfileInfo(
                id = o.getInt("id"),
                name = o.optString("name", ""),
                avatarUrl = o.optString("avatar_url", "").takeIf { u -> u.isNotBlank() },
            )
        }
    }

    private fun parseTorrentLang(arr: JSONArray?, lang: String): List<TorrentCandidate> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val magnet = o.optString("magnet", "")
            if (magnet.isBlank()) return@mapNotNull null
            TorrentCandidate(
                title = o.optString("title", ""),
                magnet = magnet,
                size = o.optLong("size", 0L),
                seeders = o.optInt("seeders", 0),
                peers = o.optInt("peers", 0),
                tracker = o.optString("tracker", ""),
                quality = o.optString("quality", "").takeIf { it.isNotBlank() },
                videotype = o.optString("videotype", ""),
                lang = lang,
            )
        }
    }
}
