package com.nestify.nestifyplayer

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class TmdbItem(
    val tmdbId: Int,
    val mediaType: String,   // "movie" or "tv"
    val title: String,
    val posterUrl: String?,
    val backdropUrl: String?,
    val year: String,
    val rating: String,
    val genreIds: List<Int> = emptyList(),
    val overview: String = "",
)

object TmdbClient {

    private val TAG = "TmdbClient"
    private const val TMDB_BASE = "https://api.themoviedb.org/3"
    private const val TMDB_IMG  = "https://image.tmdb.org/t/p"
    private const val LANG      = "uk-UA"

    @Volatile var apiKey: String = ""

    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun posterUrl(path: String?, size: String = "w342") =
        if (!path.isNullOrBlank()) "$TMDB_IMG/$size$path" else null

    fun backdropUrl(path: String?, size: String = "w780") =
        if (!path.isNullOrBlank()) "$TMDB_IMG/$size$path" else null

    fun backdropOriginal(path: String?) =
        if (!path.isNullOrBlank()) "$TMDB_IMG/original$path" else null

    // ─── fetch helpers ────────────────────────────────────────────────────────

    private fun get(path: String, extraParams: Map<String, String> = emptyMap()): JSONObject? {
        if (apiKey.isBlank()) return null
        val sb = StringBuilder("$TMDB_BASE$path?api_key=$apiKey&language=$LANG")
        extraParams.forEach { (k, v) -> sb.append("&$k=$v") }
        return try {
            val req = Request.Builder().url(sb.toString()).build()
            http.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) JSONObject(resp.body!!.string()) else null
            }
        } catch (e: Exception) {
            Log.e(TAG, "GET $path error", e)
            null
        }
    }

    private fun parseItems(arr: JSONArray?, defaultType: String): List<TmdbItem> {
        arr ?: return emptyList()
        val list = mutableListOf<TmdbItem>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val type = o.optString("media_type", defaultType).takeIf { it == "movie" || it == "tv" } ?: defaultType
            val title = o.optString("title", "").ifBlank { o.optString("name", "") }
            val year = (o.optString("release_date", "").ifBlank { o.optString("first_air_date", "") }).take(4)
            val rating = "%.1f".format(o.optDouble("vote_average", 0.0)).replace(",", ".")
            val genreIds = mutableListOf<Int>()
            val ga = o.optJSONArray("genre_ids")
            if (ga != null) for (j in 0 until ga.length()) genreIds.add(ga.optInt(j))
            list.add(TmdbItem(
                tmdbId = o.optInt("id", 0),
                mediaType = type,
                title = title,
                posterUrl = posterUrl(o.optString("poster_path", null)),
                backdropUrl = backdropUrl(o.optString("backdrop_path", null)),
                year = year,
                rating = if (rating == "0.0") "" else rating,
                genreIds = genreIds,
                overview = o.optString("overview", ""),
            ))
        }
        return list
    }

    // ─── public API ──────────────────────────────────────────────────────────

    suspend fun trending(window: String = "week"): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/trending/all/$window")?.optJSONArray("results"), "movie")
    }

    suspend fun monthlyTrending(type: String = "all"): List<TmdbItem> = withContext(Dispatchers.IO) {
        val since = run {
            val c = java.util.Calendar.getInstance()
            c.add(java.util.Calendar.DAY_OF_YEAR, -30)
            "${c.get(java.util.Calendar.YEAR)}-${String.format("%02d", c.get(java.util.Calendar.MONTH)+1)}-${String.format("%02d", c.get(java.util.Calendar.DAY_OF_MONTH))}"
        }
        val mt = if (type == "movie") "movie" else if (type == "tv") "tv" else "all"
        val p = if (type == "movie") mapOf("primary_release_date.gte" to since)
                else if (type == "tv") mapOf("first_air_date.gte" to since)
                else mapOf("release_date.gte" to since, "first_air_date.gte" to since)
        parseItems(get("/trending/$mt/week", p)?.optJSONArray("results"), mt.takeIf { it != "all" } ?: "movie")
    }

    suspend fun popularMovies(): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/movie/popular")?.optJSONArray("results"), "movie")
    }

    suspend fun popularTv(): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/tv/popular")?.optJSONArray("results"), "tv")
    }

    suspend fun nowPlaying(): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/movie/now_playing")?.optJSONArray("results"), "movie")
    }

    suspend fun topRated(type: String): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/$type/top_rated")?.optJSONArray("results"), type)
    }

    suspend fun onTheAir(): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/tv/on_the_air")?.optJSONArray("results"), "tv")
    }

    suspend fun discover(type: String, params: Map<String, String>): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/discover/$type", params)?.optJSONArray("results"), type)
    }

    suspend fun movieDetails(tmdbId: Int): JSONObject? = withContext(Dispatchers.IO) {
        get("/movie/$tmdbId", mapOf("append_to_response" to "images,videos,credits"))
    }

    suspend fun tvDetails(tmdbId: Int): JSONObject? = withContext(Dispatchers.IO) {
        get("/tv/$tmdbId", mapOf("append_to_response" to "images,videos,credits"))
    }

    suspend fun recommendations(tmdbId: Int, type: String): List<TmdbItem> = withContext(Dispatchers.IO) {
        parseItems(get("/$type/$tmdbId/recommendations")?.optJSONArray("results"), type)
    }

    // Build FeaturedItem from a TmdbItem (fetches full details for backdrop/logo)
    suspend fun toFeaturedItem(item: TmdbItem): FeaturedItem? = withContext(Dispatchers.IO) {
        try {
            val details = if (item.mediaType == "tv") tvDetails(item.tmdbId) else movieDetails(item.tmdbId)

            // best clean backdrop
            val backdrops = details?.optJSONObject("images")?.optJSONArray("backdrops")
            var bestBackdrop: String? = null
            if (backdrops != null) {
                var bestScore = -1.0
                for (i in 0 until backdrops.length()) {
                    val b = backdrops.optJSONObject(i) ?: continue
                    val lang = b.optString("iso_639_1", "x")
                    if (lang == "null" || lang.isBlank()) {
                        val score = b.optDouble("vote_average", 0.0)
                        if (score > bestScore) { bestScore = score; bestBackdrop = b.optString("file_path", null) }
                    }
                }
            }

            val backdropUrl = if (bestBackdrop != null) backdropOriginal(bestBackdrop)
                              else backdropOriginal(details?.optString("backdrop_path"))
                                   ?: item.backdropUrl

            // genres
            val genresArr = details?.optJSONArray("genres")
            val genres = mutableListOf<String>()
            if (genresArr != null) {
                for (i in 0 until minOf(genresArr.length(), 2)) {
                    genres.add(genresArr.optJSONObject(i)?.optString("name", "") ?: "")
                }
            }

            val title = details?.optString("title", "")?.ifBlank { details.optString("name", "") } ?: item.title
            val year = (details?.optString("release_date", "")?.ifBlank { details.optString("first_air_date", "") } ?: "").take(4)
            val rating = details?.optDouble("vote_average", 0.0)?.let { if (it > 0) "%.1f".format(it) else "" } ?: ""

            FeaturedItem(
                tmdbId = item.tmdbId,
                mediaType = item.mediaType,
                title = title.ifBlank { item.title },
                backdropUrl = backdropUrl,
                posterUrl = posterUrl(details?.optString("poster_path")),
                genres = genres.filter { it.isNotBlank() },
                year = year.ifBlank { item.year },
                rating = rating.ifBlank { item.rating },
                overview = details?.optString("overview", "") ?: item.overview,
            )
        } catch (e: Exception) {
            Log.e(TAG, "toFeaturedItem error for ${item.tmdbId}", e)
            null
        }
    }
}
