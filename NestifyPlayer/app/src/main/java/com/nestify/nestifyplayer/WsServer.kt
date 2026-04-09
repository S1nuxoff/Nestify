package com.nestify.nestifyplayer

import android.util.Log
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress

class WsServer(
    port: Int,
    private val controller: RemoteHttpServer.RemoteController,
    private val statusProvider: () -> PlayerStatus
) : WebSocketServer(InetSocketAddress(port)) {

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        Log.d("WsServer", "onOpen from ${conn.remoteSocketAddress}")
        val st = statusProvider()
        sendNotificationTo(conn, "Player.OnConnect", st)
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        Log.d("WsServer", "onClose code=$code reason=$reason remote=$remote")
    }

    override fun onMessage(conn: WebSocket, message: String) {
        Log.d("WsServer", "IN: $message")
        try {
            val obj = JSONObject(message)
            val method = obj.optString("method", "")
            val idAny = if (obj.has("id")) obj.get("id") else null
            val params = obj.optJSONObject("params") ?: JSONObject()

            when (method) {
                // ▶▶▶ НОВЕ: запуск відтворення по WS
                "Player.PlayUrl" -> {
                    val url = params.optString("url", null)
                    if (url.isNullOrBlank()) {
                        Log.w("WsServer", "Player.PlayUrl without url")
                        respondError(conn, idAny, "Missing url")
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

                    val movieIdAny = params.opt("movie_id")
                    val movieId = movieIdAny?.toString()

                    val season: Int? =
                        if (params.has("season") && !params.isNull("season"))
                            params.optInt("season")
                        else null

                    val episode: Int? =
                        if (params.has("episode") && !params.isNull("episode"))
                            params.optInt("episode")
                        else null

                    val userIdAny = params.opt("user_id")
                    val userId = userIdAny?.toString()

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
                        "WsServer",
                        "RPC Player.PlayUrl url=$url movieId=$movieId season=$season episode=$episode userId=$userId startPositionMs=$startPositionMs"
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

                    respondOk(conn, idAny)
                }

                // старі методи
                "Player.PlayPause" -> {
                    Log.d("WsServer", "RPC Player.PlayPause -> togglePlayPause()")
                    controller.togglePlayPause()
                    respondOk(conn, idAny)
                }

                "Player.Stop" -> {
                    Log.d("WsServer", "RPC Player.Stop")
                    controller.stopPlayback()
                    respondOk(conn, idAny)
                }

                "Player.Seek" -> {
                    val pos = params.optLong("position_ms", -1L)
                    Log.d("WsServer", "RPC Player.Seek position_ms=$pos")
                    if (pos >= 0) controller.seekTo(pos)
                    respondOk(conn, idAny)
                }

                "Application.SetVolume" -> {
                    val vol = params.optInt("volume", -1)
                    Log.d("WsServer", "RPC Application.SetVolume volume=$vol")
                    if (vol >= 0) controller.setVolume(vol)
                    respondOk(conn, idAny)
                }

                "Player.GetStatus" -> {
                    Log.d("WsServer", "RPC Player.GetStatus")
                    val st = statusProvider()
                    val res = statusToJson(st)
                    sendResponse(conn, idAny, res)
                }

                else -> {
                    Log.w("WsServer", "Unknown method: $method")
                    respondError(conn, idAny, "Unknown method: $method")
                }
            }
        } catch (e: Exception) {
            Log.e("WsServer", "Error in onMessage", e)
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        Log.e("WsServer", "onError conn=$conn", ex)
    }

    override fun onStart() {
        Log.d("WsServer", "WebSocket server started on $address")
    }

    private fun respondOk(conn: WebSocket, id: Any?) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("result", "OK")
        val text = obj.toString()
        Log.d("WsServer", "OUT: $text")
        conn.send(text)
    }

    private fun respondError(conn: WebSocket, id: Any?, msg: String) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("error", JSONObject().put("code", -1).put("message", msg))
        val text = obj.toString()
        Log.d("WsServer", "OUT ERROR: $text")
        conn.send(text)
    }

    private fun sendResponse(conn: WebSocket, id: Any?, result: JSONObject) {
        if (id == null) return
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("result", result)
        val text = obj.toString()
        Log.d("WsServer", "OUT: $text")
        conn.send(text)
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

    private fun buildNotification(method: String, st: PlayerStatus): String {
        val obj = JSONObject()
            .put("jsonrpc", "2.0")
            .put("method", method)
            .put("params", JSONObject().put("data", statusToJson(st)))
        return obj.toString()
    }

    fun sendNotification(method: String, st: PlayerStatus) {
        val text = buildNotification(method, st)
        Log.d("WsServer", "OUT NOTIFY(broadcast): $text")
        broadcast(text)
    }

    private fun sendNotificationTo(conn: WebSocket, method: String, st: PlayerStatus) {
        val text = buildNotification(method, st)
        Log.d("WsServer", "OUT NOTIFY(to one): $text")
        conn.send(text)
    }
}
