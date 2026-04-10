package com.nestify.nestifyplayer

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.util.concurrent.TimeUnit

object FeaturedDataSource {

    private val TAG = "FeaturedDataSource"

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun load(userId: String, backendBaseUrl: String): List<FeaturedItem> =
        withContext(Dispatchers.IO) {
            try {
                val url = buildString {
                    append(backendBaseUrl)
                    append("/api/v3/featured")
                    if (userId.isNotBlank()) append("?user_id=$userId")
                }
                Log.d(TAG, "GET $url")

                val json = getJson(url) ?: return@withContext emptyList()
                val arr = JSONArray(json)

                (0 until arr.length()).mapNotNull { i ->
                    val obj = arr.getJSONObject(i)
                    val backdropUrl = obj.optString("backdrop_url", "").takeIf { it.isNotEmpty() }
                    val posterUrl = obj.optString("poster_url", "").takeIf { it.isNotEmpty() }
                    if (backdropUrl == null && posterUrl == null) return@mapNotNull null

                    val genresArr = obj.optJSONArray("genres")
                    val genres = if (genresArr != null) {
                        (0 until genresArr.length()).map { genresArr.getString(it) }
                    } else emptyList()

                    FeaturedItem(
                        tmdbId    = obj.optInt("tmdb_id", 0),
                        mediaType = obj.optString("media_type", "movie"),
                        title     = obj.optString("title", ""),
                        backdropUrl = backdropUrl,
                        posterUrl   = posterUrl,
                        genres    = genres,
                        year      = obj.optString("year", ""),
                        rating    = obj.optString("rating", ""),
                        overview  = obj.optString("overview", ""),
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "load() error", e)
                emptyList()
            }
        }

    private fun getJson(url: String): String? {
        return try {
            val req = Request.Builder().url(url).build()
            http.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) resp.body?.string() else {
                    Log.w(TAG, "HTTP ${resp.code} for $url")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getJson($url) error", e)
            null
        }
    }
}
