package com.nestify.nestifyplayer

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONObject
import java.net.URI

interface PlayerHubListener {
    fun onControllerConnected(profileName: String)
    fun onControllerConnectedWithAvatar(profileName: String, avatarUrl: String, userId: String = "")
    fun onControllerDisconnected()
}

class PlayerWsClient(
    private val baseUrl: String,                      // напр. "wss://api.opencine.cloud"
    private val deviceId: String,                     // DeviceId.get(context)
    private val controller: RemoteHttpServer.RemoteController,
    private val statusProvider: () -> PlayerStatus,
    private val hubListener: PlayerHubListener? = null,
) {

    private val TAG = "PlayerWsClient"

    private var client: WebSocketClient? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val reconnectDelayMs = 5000L
    private var reconnectScheduled = false
    @Volatile
    private var shouldReconnect = true

    private val reconnectRunnable = Runnable {
        reconnectScheduled = false
        connect()
    }

    // ------------- PUBLIC -------------

    fun connect() {
        shouldReconnect = true
        // isConnecting в цій бібліотеці немає, перевіряємо тільки isOpen
        val existing = client
        if (existing != null && existing.isOpen) {
            Log.d(TAG, "connect() skipped: already open")
            return
        }

        val effectiveBase = baseUrl.ifBlank { BuildConfig.WS_BASE_URL }
        val url = "$effectiveBase/ws/player/$deviceId"
        Log.d(TAG, "Connecting to $url")

        val uri = URI(url)

        client = object : WebSocketClient(uri) {

            override fun onOpen(handshakedata: ServerHandshake?) {
                Log.d(TAG, "WS connected to $uri")
                reconnectScheduled = false

                // При коннекте — одразу шлемо Player.OnConnect зі статусом
                trySendNotification("Player.OnConnect", statusProvider())
            }

            override fun onMessage(message: String?) {
                if (message == null) return
                Log.d(TAG, "IN: $message")
                handleIncoming(message)
            }

            override fun onClose(code: Int, reason: String?, remote: Boolean) {
                Log.d(TAG, "WS closed code=$code reason=$reason remote=$remote")
                client = null
                if (shouldReconnect) {
                    scheduleReconnect()
                }
            }

            override fun onError(ex: Exception?) {
                Log.e(TAG, "WS error", ex)
            }
        }

        client?.connect()
    }

    fun close() {
        shouldReconnect = false
        reconnectScheduled = false
        mainHandler.removeCallbacks(reconnectRunnable)
        try {
            client?.close()
        } catch (_: Exception) {
        }
        client = null
    }

    fun sendNotification(method: String, status: PlayerStatus) {
        trySendNotification(method, status)
    }

    // ------------- INTERNAL -------------

    private fun scheduleReconnect() {
        if (reconnectScheduled) return
        reconnectScheduled = true
        mainHandler.postDelayed(reconnectRunnable, reconnectDelayMs)
    }

    private fun trySendNotification(method: String, st: PlayerStatus) {
        val c = client
        if (c == null || !c.isOpen) {
            Log.d(TAG, "skip sendNotification($method): ws not open")
            return
        }

        val text = buildNotification(method, st)
        Log.d(TAG, "OUT NOTIFY: $text")
        try {
            c.send(text)
        } catch (e: Exception) {
            Log.e(TAG, "sendNotification error", e)
        }
    }

    private fun buildNotification(method: String, st: PlayerStatus): String {
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("method", method)
            .put(
                "params",
                JSONObject().put("data", statusToJson(st))
            )
        return obj.toString()
    }

    private fun statusToJson(st: PlayerStatus): JSONObject {
        return JSONObject()
            .put("position_ms", st.positionMs)
            .put("duration_ms", st.durationMs)
            .put("is_playing", st.isPlaying)
            .put("volume", st.volume)
            .put("link", st.link)
            .put("origin_name", st.originName)
            .put("title", st.title)
            .put("image", st.image)
            .put("movie_id", st.movieId)
            .put("season", st.season)
            .put("episode", st.episode)
            .put("user_id", st.userId)
    }

    private fun handleIncoming(message: String) {
        try {
            val obj = JSONObject(message)
            val method = obj.optString("method", "")
            val idAny = if (obj.has("id")) obj.get("id") else null
            val params = obj.optJSONObject("params") ?: JSONObject()

            when (method) {
                // RPC от бэка → управляющие методы

                "Player.PlayUrl" -> {
                    val url = params.optString("url", null)
                    if (url.isNullOrBlank()) {
                        Log.w(TAG, "Player.PlayUrl without url")
                        respondError(idAny, "Missing url")
                        return
                    }

                    val link = params.optString("link", null)
                        ?.takeIf { it.isNotBlank() }

                    val originName = params.optString("origin_name", null)
                        ?.takeIf { it.isNotBlank() }

                    val title = params.optString("title", null)
                        ?.takeIf { it.isNotBlank() }

                    val image = params.optString("image", null)
                        ?.takeIf { it.isNotBlank() }

                    val movieId = params.optStringOrNull("movie_id")

                    val season: Int? =
                        if (params.has("season") && !params.isNull("season"))
                            params.optInt("season")
                        else null

                    val episode: Int? =
                        if (params.has("episode") && !params.isNull("episode"))
                            params.optInt("episode")
                        else null

                    val userId = params.optStringOrNull("user_id")

                    val startPositionMs: Long? = when {
                        params.has("position_ms") && !params.isNull("position_ms") -> {
                            val ms = params.optLong("position_ms", -1L)
                            if (ms >= 0) ms else null
                        }

                        params.has("position_seconds") && !params.isNull("position_seconds") -> {
                            val secAny = params.get("position_seconds")
                            val sec = when (secAny) {
                                is Number -> secAny.toDouble()
                                is String -> secAny.toDoubleOrNull() ?: 0.0
                                else -> 0.0
                            }
                            (sec * 1000.0).toLong()
                        }

                        else -> null
                    }

                    Log.d(
                        TAG,
                        "RPC Player.PlayUrl url=$url movieId=$movieId season=$season " +
                                "episode=$episode userId=$userId startPositionMs=$startPositionMs"
                    )

                    controller.playUrl(
                        url,
                        link,
                        originName,
                        title,
                        image,
                        movieId,
                        season,
                        episode,
                        userId,
                        startPositionMs
                    )

                    respondOk(idAny)
                }

                "Player.PlayPause" -> {
                    Log.d(TAG, "RPC Player.PlayPause -> togglePlayPause()")
                    controller.togglePlayPause()
                    respondOk(idAny)
                }

                "Player.Stop" -> {
                    Log.d(TAG, "RPC Player.Stop")
                    controller.stopPlayback()
                    respondOk(idAny)
                }

                "Player.Seek" -> {
                    val pos = params.optLong("position_ms", -1L)
                    Log.d(TAG, "RPC Player.Seek position_ms=$pos")
                    if (pos >= 0) controller.seekTo(pos)
                    respondOk(idAny)
                }

                "Application.SetVolume" -> {
                    val vol = params.optInt("volume", -1)
                    Log.d(TAG, "RPC Application.SetVolume volume=$vol")
                    if (vol >= 0) controller.setVolume(vol)
                    respondOk(idAny)
                }

                "Player.GetStatus" -> {
                    Log.d(TAG, "RPC Player.GetStatus")
                    val st = statusProvider()
                    val res = statusToJson(st)
                    sendResponse(idAny, res)
                }

                "PlayerHub.ControllerConnected" -> {
                    val profileName = params.optString("profile_name", "")
                    val avatarUrl = params.optString("avatar_url", "")
                    val userId = params.optString("user_id", "")
                    Log.d(TAG, "ControllerConnected profileName=$profileName avatar=$avatarUrl userId=$userId")
                    mainHandler.post {
                        hubListener?.onControllerConnectedWithAvatar(profileName, avatarUrl, userId)
                    }
                }

                "PlayerHub.ControllerDisconnected" -> {
                    Log.d(TAG, "ControllerDisconnected")
                    mainHandler.post {
                        hubListener?.onControllerDisconnected()
                    }
                }

                else -> {
                    if (idAny != null) {
                        respondError(idAny, "Unknown method: $method")
                    } else {
                        Log.w(TAG, "Unknown method without id: $method")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in handleIncoming", e)
        }
    }

    private fun respondOk(id: Any?) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("result", "OK")
        sendRaw(obj.toString())
    }

    private fun respondError(id: Any?, msg: String) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put(
                "error",
                JSONObject()
                    .put("code", -1)
                    .put("message", msg)
            )
        sendRaw(obj.toString())
    }

    private fun sendResponse(id: Any?, result: JSONObject) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("result", result)
        sendRaw(obj.toString())
    }

    fun sendRaw(text: String) {
        val c = client
        if (c == null || !c.isOpen) {
            Log.d(TAG, "skip sendRaw: ws not open")
            return
        }
        Log.d(TAG, "OUT: $text")
        try {
            c.send(text)
        } catch (e: Exception) {
            Log.e(TAG, "sendRaw error", e)
        }
    }
}

/**
 * Returns the string value for [key], or null if the key is absent, JSON null, or the literal
 * string "null".
 */
private fun org.json.JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    val v = optString(key, "")
    return if (v.isEmpty() || v == "null") null else v
}
