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

    // --------- CORS helper ----------

    private fun withCors(resp: Response): Response {
        resp.addHeader("Access-Control-Allow-Origin", "*")
        resp.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        resp.addHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")
        return resp
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri

        if (session.method == Method.OPTIONS) {
            return withCors(
                newFixedLengthResponse(
                    Response.Status.OK,
                    "text/plain",
                    ""
                )
            )
        }

        return when {
            uri == "/" || uri == "/config" -> withCors(handleConfigHtml(session))
            uri == "/settings" -> withCors(handleSettingsJson(session))

            uri == "/play" -> {
                val url = session.parms["url"]
                if (url.isNullOrBlank()) {
                    withCors(
                        newFixedLengthResponse(
                            Response.Status.BAD_REQUEST,
                            "text/plain",
                            "Missing url"
                        )
                    )
                } else {
                    val link = session.parms["link"]
                    val originName = session.parms["origin_name"]
                    val title = session.parms["title"]
                    val image = session.parms["image"]

                    val movieId = session.parms["movie_id"]
                    val seasonStr = session.parms["season"]
                    val episodeStr = session.parms["episode"]
                    val userId = session.parms["user_id"]

                    val season = seasonStr?.toIntOrNull()
                    val episode = episodeStr?.toIntOrNull()

                    val positionSecondsStr = session.parms["position_seconds"]
                    val startPositionMs = positionSecondsStr
                        ?.toLongOrNull()
                        ?.let { it * 1000L }

                    controller.playUrl(
                        url = url,
                        link = link,
                        originName = originName,
                        title = title,
                        image = image,
                        movieId = movieId,
                        season = season,
                        episode = episode,
                        userId = userId,
                        startPositionMs = startPositionMs
                    )
                    withCors(newFixedLengthResponse("Playing: $url"))
                }
            }

            uri == "/pause" -> {
                controller.pause()
                withCors(newFixedLengthResponse("Paused"))
            }

            uri == "/resume" -> {
                controller.resume()
                withCors(newFixedLengthResponse("Resumed"))
            }

            uri == "/stop" -> {
                controller.stopPlayback()
                withCors(newFixedLengthResponse("Stopped"))
            }

            uri == "/seek" -> {
                val pos = session.parms["position_ms"]?.toLongOrNull()
                if (pos == null) {
                    withCors(
                        newFixedLengthResponse(
                            Response.Status.BAD_REQUEST,
                            "text/plain",
                            "Missing position_ms"
                        )
                    )
                } else {
                    controller.seekTo(pos)
                    withCors(newFixedLengthResponse("Seek to $pos"))
                }
            }

            uri == "/set_volume" -> {
                val v = session.parms["value"]?.toIntOrNull()
                if (v == null) {
                    withCors(
                        newFixedLengthResponse(
                            Response.Status.BAD_REQUEST,
                            "text/plain",
                            "Missing value"
                        )
                    )
                } else {
                    controller.setVolume(v)
                    withCors(newFixedLengthResponse("Volume set to $v"))
                }
            }

            uri == "/status" -> {
                val st = controller.getStatus()
                val json = JSONObject()
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
                    .toString()

                withCors(
                    newFixedLengthResponse(
                        Response.Status.OK,
                        "application/json",
                        json
                    )
                )
            }

            else -> withCors(
                newFixedLengthResponse(
                    Response.Status.NOT_FOUND,
                    "text/plain",
                    "Not found"
                )
            )
        }
    }

    // ----- JSON API для налаштувань -----

    private fun handleSettingsJson(session: IHTTPSession): Response {
        return if (session.method == Method.GET) {
            val cfg = AmbientConfig
            val json = JSONObject()
                .put("wled_ip", cfg.wledIp)
                .put("enabled", cfg.enabled)
                .put("update_interval_ms", cfg.updateIntervalMs)
                .put("black_bar_luma_threshold", cfg.blackBarLumaThreshold)
                .toString()

            newFixedLengthResponse(Response.Status.OK, "application/json", json)
        } else if (session.method == Method.POST) {
            val files = HashMap<String, String>()
            try {
                session.parseBody(files)
            } catch (_: Exception) {}

            val body = files["postData"] ?: ""
            try {
                val obj = JSONObject(body)

                if (obj.has("wled_ip")) {
                    AmbientConfig.wledIp = obj.optString("wled_ip", AmbientConfig.wledIp)
                }
                if (obj.has("enabled")) {
                    AmbientConfig.enabled = obj.optBoolean("enabled", AmbientConfig.enabled)
                }
                if (obj.has("update_interval_ms")) {
                    val v = obj.optLong("update_interval_ms", AmbientConfig.updateIntervalMs)
                    AmbientConfig.updateIntervalMs = v.coerceAtLeast(100L)
                }
                if (obj.has("black_bar_luma_threshold")) {
                    AmbientConfig.blackBarLumaThreshold =
                        obj.optInt(
                            "black_bar_luma_threshold",
                            AmbientConfig.blackBarLumaThreshold
                        )
                }

                AmbientConfig.save(appContext)
            } catch (_: Exception) {
            }

            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                """{"status":"ok"}"""
            )
        } else {
            newFixedLengthResponse(
                Response.Status.METHOD_NOT_ALLOWED,
                "text/plain",
                "Only GET/POST"
            )
        }
    }

    // ----- HTML-конфіг -----

    private fun handleConfigHtml(session: IHTTPSession): Response {
        return if (session.method == Method.POST) {
            val files = HashMap<String, String>()
            try {
                session.parseBody(files)
            } catch (_: Exception) {
            }

            val p = session.parms
            AmbientConfig.wledIp = p["wledIp"] ?: AmbientConfig.wledIp
            AmbientConfig.enabled = p["enabled"] == "on"
            AmbientConfig.updateIntervalMs =
                (p["updateIntervalMs"]?.toLongOrNull() ?: AmbientConfig.updateIntervalMs)
                    .coerceAtLeast(100L)
            AmbientConfig.blackBarLumaThreshold =
                p["blackBarLumaThreshold"]?.toIntOrNull()
                    ?: AmbientConfig.blackBarLumaThreshold

            AmbientConfig.save(appContext)

            val html = """
                <html>
                  <head>
                    <meta http-equiv="refresh" content="1;url=/config" />
                  </head>
                  <body style="background:#050510;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                    <div style="text-align:center;">
                      <h3>Налаштування збережено</h3>
                      <p>Повертаю назад…</p>
                    </div>
                  </body>
                </html>
            """.trimIndent()
            newFixedLengthResponse(Response.Status.OK, "text/html", html)
        } else {
            val cfg = AmbientConfig
            val checked = if (cfg.enabled) "checked" else ""
            val html = """
                <html>
                <head>
                  <title>Nestify Ambient Settings</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <style>
                    :root {
                      --bg: #050510;
                      --card-bg: rgba(20, 18, 34, 0.96);
                      --accent: #ffcffa;
                      --accent-soft: rgba(255, 207, 250, 0.15);
                      --text-main: #f5f0ff;
                      --text-muted: #a39bbd;
                      --border: rgba(255, 255, 255, 0.06);
                      --radius-xl: 24px;
                    }

                    * { box-sizing: border-box; }

                    body {
                      margin: 0;
                      padding: 0;
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
                      background: radial-gradient(circle at 0 0, #2a1043 0, transparent 45%),
                                  radial-gradient(circle at 100% 100%, #1c103a 0, transparent 40%),
                                  var(--bg);
                      color: var(--text-main);
                    }

                    .shell {
                      width: 100%;
                      max-width: 920px;
                      padding: 24px;
                    }

                    .card {
                      position: relative;
                      border-radius: var(--radius-xl);
                      padding: 24px 24px 20px;
                      background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(8,7,18,0.98));
                      border: 1px solid var(--border);
                      box-shadow:
                        0 32px 80px rgba(0,0,0,0.7),
                        0 0 0 1px rgba(255,255,255,0.02);
                      overflow: hidden;
                    }

                    .card::before {
                      content: "";
                      position: absolute;
                      inset: 0;
                      background:
                        radial-gradient(circle at 10% 0, rgba(255,207,250,0.13), transparent 55%),
                        radial-gradient(circle at 85% 100%, rgba(145,106,255,0.18), transparent 55%);
                      mix-blend-mode: screen;
                      opacity: 0.8;
                      pointer-events: none;
                    }

                    .card-inner {
                      position: relative;
                      z-index: 1;
                      display: grid;
                      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
                      gap: 24px;
                    }

                    @media (max-width: 720px) {
                      .card-inner {
                        grid-template-columns: minmax(0,1fr);
                      }
                    }

                    .title-row {
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 16px;
                      margin-bottom: 16px;
                    }

                    .title {
                      font-size: 22px;
                      font-weight: 700;
                      letter-spacing: 0.04em;
                      text-transform: uppercase;
                    }

                    .badge {
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      padding: 4px 10px;
                      border-radius: 999px;
                      background: rgba(5,5,16,0.6);
                      border: 1px solid var(--accent-soft);
                      font-size: 11px;
                      text-transform: uppercase;
                      letter-spacing: 0.12em;
                      color: var(--accent);
                    }

                    .subtitle {
                      margin: 0 0 20px;
                      font-size: 13px;
                      color: var(--text-muted);
                    }

                    .field {
                      margin-bottom: 16px;
                    }

                    .field label {
                      display: block;
                      font-size: 13px;
                      font-weight: 500;
                      margin-bottom: 6px;
                    }

                    .field small {
                      display: block;
                      font-size: 11px;
                      color: var(--text-muted);
                      margin-top: 3px;
                    }

                    textarea,
                    input[type="number"] {
                      width: 100%;
                      padding: 10px 12px;
                      border-radius: 16px;
                      border: 1px solid var(--border);
                      background: rgba(3, 3, 12, 0.9);
                      color: var(--text-main);
                      font-size: 13px;
                      outline: none;
                      resize: vertical;
                    }

                    textarea {
                      min-height: 90px;
                      max-height: 220px;
                    }

                    textarea:focus,
                    input[type="number"]:focus {
                      border-color: rgba(255,207,250,0.7);
                      box-shadow: 0 0 0 1px rgba(255,207,250,0.4);
                    }

                    .switch-row {
                      display: flex;
                      align-items: center;
                      gap: 10px;
                      margin-bottom: 16px;
                    }

                    .switch-row label {
                      margin: 0;
                    }

                    .hint {
                      font-size: 11px;
                      color: var(--text-muted);
                    }

                    button {
                      margin-top: 8px;
                      padding: 9px 18px;
                      border-radius: 999px;
                      border: none;
                      outline: none;
                      font-size: 13px;
                      font-weight: 600;
                      letter-spacing: 0.06em;
                      text-transform: uppercase;
                      cursor: pointer;
                      background: radial-gradient(circle at 0 0, #ffe0ff 0, #ff9ffe 40%, #8d6bff 100%);
                      color: #1b0d2a;
                      box-shadow: 0 14px 30px rgba(0,0,0,0.6);
                    }

                    button:hover {
                      filter: brightness(1.02);
                    }

                    .side {
                      padding: 10px 14px;
                      border-radius: 18px;
                      background: rgba(5, 5, 18, 0.9);
                      border: 1px solid rgba(255,255,255,0.06);
                      font-size: 12px;
                    }

                    .side h3 {
                      margin: 0 0 8px;
                      font-size: 13px;
                      text-transform: uppercase;
                      letter-spacing: 0.14em;
                      color: var(--accent);
                    }

                    code {
                      font-size: 11px;
                      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                      background: rgba(255,255,255,0.04);
                      padding: 2px 5px;
                      border-radius: 6px;
                    }

                    .code-block {
                      margin-top: 10px;
                      padding: 8px 10px;
                      border-radius: 10px;
                      background: rgba(0,0,0,0.45);
                      border: 1px solid rgba(255,255,255,0.05);
                      overflow-x: auto;
                    }
                  </style>
                </head>
                <body>
                  <div class="shell">
                    <div class="card">
                      <div class="card-inner">
                        <div>
                          <div class="title-row">
                            <div>
                              <div class="title">Nestify Ambient</div>
                              <p class="subtitle">Керування WLED під час відтворення відео на Nestify Player.</p>
                            </div>
                            <span class="badge">Player device</span>
                          </div>

                          <form method="post" action="/config">
                            <div class="field">
                              <label>WLED девайси</label>
                              <textarea name="wledIp" placeholder="192.168.0.221
192.168.0.222  # кухня
192.168.0.223  # спальня">${cfg.wledIp}</textarea>
                              <small>Кожен WLED — з нового рядка. Коментарі після <code>#</code> ігноруються.</small>
                            </div>

                            <div class="switch-row">
                              <input type="checkbox" id="enabled" name="enabled" $checked />
                              <label for="enabled">Увімкнути Ambient режим</label>
                            </div>

                            <div class="field">
                              <label>Інтервал оновлення (мс)</label>
                              <input type="number" name="updateIntervalMs" min="50" value="${cfg.updateIntervalMs}" />
                              <small>Чим менше значення — тим плавніше Ambilight, але більша нагрузка.</small>
                            </div>

                            <div class="field">
                              <label>Поріг чорних полос (0–255)</label>
                              <input type="number" name="blackBarLumaThreshold" min="0" max="255" value="${cfg.blackBarLumaThreshold}" />
                              <small>Використовується для авто-вирізання letterbox (чорні смуги зверху/знизу).</small>
                            </div>

                            <button type="submit">Зберегти налаштування</button>
                          </form>
                        </div>

                        <div class="side">
                          <h3>HTTP / API</h3>
                          <p class="hint">
                            Цей плеєр піднімає міні-сервер для керування відтворенням та Ambilight'ом.
                          </p>
                          <div class="code-block">
                            <div><code>GET /status</code> – статус плеєра</div>
                            <div><code>GET /settings</code>, <code>POST /settings</code> – JSON конфіг</div>
                            <div><code>/play?url=...&amp;position_seconds=...</code> – запустити відтворення</div>
                          </div>
                          <p class="hint" style="margin-top:10px;">
                            WLED отримує кольори через <code>/json/state</code>. 
                            Цей режим без UDP, але максимально простий і стабільний.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </body>
                </html>
            """.trimIndent()
            newFixedLengthResponse(Response.Status.OK, "text/html", html)
        }
    }
}
