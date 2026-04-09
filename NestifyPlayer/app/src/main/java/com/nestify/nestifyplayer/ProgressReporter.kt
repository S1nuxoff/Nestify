package com.nestify.nestifyplayer

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

object ProgressReporter {

    private const val TAG = "ProgressReporter"

    // раз у 5 секунд
    private const val INTERVAL_MS = 5000L

    // не спамити, якщо змінилось < 3 сек
    private const val MIN_DELTA_MS = 3000L

    private var lastSentPosMs: Long = -1L
    private var thread: Thread? = null

    @Volatile
    private var running: Boolean = false

    private val BASE_URL get() = BuildConfig.BACKEND_BASE_URL

    fun start(statusProvider: () -> PlayerStatus) {
        if (running) {
            Log.d(TAG, "start() called but already running")
            return
        }
        Log.d(TAG, "start() — launching background thread")
        running = true

        thread = Thread {
            while (running) {
                try {
                    val st = statusProvider()
                    Log.d(
                        TAG,
                        "tick: pos=${st.positionMs} dur=${st.durationMs} isPlaying=${st.isPlaying} " +
                                "userId=${st.userId} movieId=${st.movieId}"
                    )
                    sendProgress(st, force = false)
                    Thread.sleep(INTERVAL_MS)
                } catch (e: InterruptedException) {
                    Log.d(TAG, "thread interrupted, stopping loop")
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "error in background loop", e)
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        Log.d(TAG, "stop() called")
        running = false
        thread?.interrupt()
        thread = null
        lastSentPosMs = -1L
    }

    /**
     * Синхронізуємо lastSentPosMs з поточною позицією ExoPlayer одразу після STATE_READY.
     * Без цього перший tick може звітувати позицію 0 якщо seekTo ще не відпрацював.
     */
    fun syncPosition(positionMs: Long) {
        lastSentPosMs = positionMs
    }

    // одразу відправити прогрес (ігноруючи isPlaying / дельту)
    fun reportImmediate(st: PlayerStatus) {
        Log.d(
            TAG,
            "reportImmediate: pos=${st.positionMs} dur=${st.durationMs} userId=${st.userId} movieId=${st.movieId}"
        )
        sendProgress(st, force = true)
    }

    private fun sendProgress(st: PlayerStatus, force: Boolean) {
        val userId = st.userId?.toIntOrNull()
        if (userId == null) {
            Log.d(TAG, "skip send: userId is null or not int (raw='${st.userId}')")
            return
        }

        val movieId = st.movieId
        if (movieId.isNullOrBlank()) {
            Log.d(TAG, "skip send: movieId is null/blank")
            return
        }

        if (st.durationMs <= 0L) {
            Log.d(TAG, "skip send: durationMs <= 0 (${st.durationMs})")
            return
        }

        if (!st.isPlaying && !force) {
            Log.d(TAG, "skip send: not playing and not force")
            return
        }

        if (!force &&
            lastSentPosMs >= 0L &&
            abs(st.positionMs - lastSentPosMs) < MIN_DELTA_MS
        ) {
            Log.d(
                TAG,
                "skip send: delta < MIN_DELTA_MS (pos=${st.positionMs}, last=$lastSentPosMs)"
            )
            return
        }

        try {
            val url = URL("$BASE_URL/api/v1/rezka/progress")
            Log.d(
                TAG,
                "sending PUT $url userId=$userId movieId=$movieId posMs=${st.positionMs} durMs=${st.durationMs} " +
                        "season=${st.season} episode=${st.episode} force=$force"
            )

            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "PUT"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val json = JSONObject()
                .put("user_id", userId)
                .put("movie_id", movieId)
                .put("position_seconds", st.positionMs / 1000)
                .put("duration", st.durationMs / 1000)
                .put("season", st.season)
                .put("episode", st.episode)
                .toString()

            conn.outputStream.use { os ->
                os.write(json.toByteArray())
                os.flush()
            }

            val code = conn.responseCode
            Log.d(TAG, "responseCode=$code")
            conn.inputStream.use { _ -> }
            conn.disconnect()

            lastSentPosMs = st.positionMs
        } catch (e: Exception) {
            Log.e(TAG, "error sending progress", e)
        }
    }
}
