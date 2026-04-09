package com.nestify.nestifyplayer

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject

data class PlayerStatus(
    val positionMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val volume: Int,
    val link: String?,
    val originName: String?,
    val title: String?,
    val image: String?,
    val movieId: String?,
    val season: Int?,
    val episode: Int?,
    val userId: String?
)

class RemoteHttpServer(
    port: Int,
    private val controller: RemoteController,
    private val appContext: Context
) : NanoHTTPD(port) {

    interface RemoteController {
        fun playUrl(
            url: String,
            link: String?,
            originName: String?,
            title: String?,
            image: String?,
            movieId: String?,
            season: Int?,
            episode: Int?,
            userId: String?,
            startPositionMs: Long? = null
        )

        fun pause()
        fun resume()
        fun stopPlayback()
        fun seekTo(positionMs: Long)
        fun setVolume(volumePercent: Int)
        fun getStatus(): PlayerStatus
        fun togglePlayPause()
    }

    private fun withCors(resp: Response): Response {
        resp.addHeader("Access-Control-Allow-Origin", "*")
        resp.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        resp.addHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")
        return resp
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri

        if (session.method == Method.OPTIONS) {
            return withCors(newFixedLengthResponse(Response.Status.OK, "text/plain", ""))
        }

        return when {
            uri == "/play" -> {
                val url = session.parms["url"]
                if (url.isNullOrBlank()) {
                    withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Missing url"))
                } else {
                    val link       = session.parms["link"]
                    val originName = session.parms["origin_name"]
                    val title      = session.parms["title"]
                    val image      = session.parms["image"]
                    val movieId    = session.parms["movie_id"]
                    val season     = session.parms["season"]?.toIntOrNull()
                    val episode    = session.parms["episode"]?.toIntOrNull()
                    val userId     = session.parms["user_id"]
                    val startMs    = session.parms["position_seconds"]?.toLongOrNull()?.let { it * 1000L }

                    controller.playUrl(url, link, originName, title, image, movieId, season, episode, userId, startMs)
                    withCors(newFixedLengthResponse("Playing: $url"))
                }
            }

            uri == "/pause"  -> { controller.pause();        withCors(newFixedLengthResponse("Paused"))   }
            uri == "/resume" -> { controller.resume();       withCors(newFixedLengthResponse("Resumed"))  }
            uri == "/stop"   -> { controller.stopPlayback(); withCors(newFixedLengthResponse("Stopped"))  }

            uri == "/seek" -> {
                val pos = session.parms["position_ms"]?.toLongOrNull()
                if (pos == null) {
                    withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Missing position_ms"))
                } else {
                    controller.seekTo(pos)
                    withCors(newFixedLengthResponse("Seek to $pos"))
                }
            }

            uri == "/set_volume" -> {
                val v = session.parms["value"]?.toIntOrNull()
                if (v == null) {
                    withCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Missing value"))
                } else {
                    controller.setVolume(v)
                    withCors(newFixedLengthResponse("Volume set to $v"))
                }
            }

            uri == "/status" -> {
                val st = controller.getStatus()
                val json = JSONObject()
                    .put("position_ms",  st.positionMs)
                    .put("duration_ms",  st.durationMs)
                    .put("is_playing",   st.isPlaying)
                    .put("volume",       st.volume)
                    .put("link",         st.link)
                    .put("origin_name",  st.originName)
                    .put("title",        st.title)
                    .put("image",        st.image)
                    .put("movie_id",     st.movieId)
                    .put("season",       st.season)
                    .put("episode",      st.episode)
                    .put("user_id",      st.userId)
                    .toString()
                withCors(newFixedLengthResponse(Response.Status.OK, "application/json", json))
            }

            else -> withCors(newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found"))
        }
    }
}
