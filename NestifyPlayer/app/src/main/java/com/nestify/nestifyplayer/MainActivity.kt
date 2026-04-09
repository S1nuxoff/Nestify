package com.nestify.nestifyplayer

import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Rect
import android.graphics.Paint
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max

class MainActivity : ComponentActivity(), RemoteHttpServer.RemoteController, PlayerHubListener {

    private val TAG = "MainActivity"

    private lateinit var playerView: PlayerView

    private lateinit var splashContainer: LinearLayout
    private lateinit var statusContainer: LinearLayout

    private lateinit var statusTitle: TextView      // "Під'єднайте ваш пристрій"
    private lateinit var infoText: TextView        // "Відскануйте QR-код" / "Пауза" / "Відтворюю відео"
    private lateinit var connectHint: TextView     // "Або перейдіть на сторінку:"
    private lateinit var linkText: TextView        // "opencine.cloud/connect"
    private lateinit var codeHint: TextView        // "Введіть код:"
    private lateinit var logoText: TextView        // "nestify"

    private lateinit var qrImage: ImageView

    // кружечки з кодом
    private lateinit var codeSlots: List<TextView>

    private var player: ExoPlayer? = null
    private var httpServer: RemoteHttpServer? = null
    private var wsClient: PlayerWsClient? = null

    private val serverPort = 8888

    // device id для WS до бекенда
    private var deviceId: String = ""
    private var shortCode: String = ""

    // meta
    private var currentLink: String? = null
    private var currentOriginName: String? = null
    private var currentTitle: String? = null
    private var currentImage: String? = null
    private var currentMovieId: String? = null
    private var currentSeason: Int? = null
    private var currentEpisode: Int? = null
    private var currentUserId: String? = null

    private val wledClient = WledClient()
    private val ambientHandler = Handler(Looper.getMainLooper())
    private var ambientRunning = false

    private val ambientRunnable = object : Runnable {
        override fun run() {
            if (!ambientRunning || !AmbientConfig.enabled) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && player != null) {
                val surfaceView = playerView.videoSurfaceView as? SurfaceView
                if (surfaceView != null) {
                    captureAndSendAverageColor(surfaceView)
                }
            }
            ambientHandler.postDelayed(this, AmbientConfig.updateIntervalMs)
        }
    }

    private val wsProgressHandler = Handler(Looper.getMainLooper())
    private val wsProgressRunnable = object : Runnable {
        override fun run() {
            if (player != null) {
                val st = getStatus()
                wsClient?.sendNotification("Player.OnProgress", st)
                wsProgressHandler.postDelayed(this, 1000L)
            }
        }
    }

    // UI для гучності
    private val volumeUiHandler = Handler(Looper.getMainLooper())
    private var volumeOverlay: TextView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        AmbientConfig.load(this)

        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.player_view)
        splashContainer = findViewById(R.id.splash_container)
        statusContainer = findViewById(R.id.status_container)

        logoText = findViewById(R.id.logo_text)
        statusTitle = findViewById(R.id.status_title)
        infoText = findViewById(R.id.info_text)
        connectHint = findViewById(R.id.connect_hint)
        linkText = findViewById(R.id.link_text)
        codeHint = findViewById(R.id.code_hint)
        qrImage = findViewById(R.id.qr_image)

        codeSlots = listOf(
            findViewById(R.id.code_slot_1),
            findViewById(R.id.code_slot_2),
            findViewById(R.id.code_slot_3),
            findViewById(R.id.code_slot_4),
            findViewById(R.id.code_slot_5),
            findViewById(R.id.code_slot_6),
            findViewById(R.id.code_slot_7),
            findViewById(R.id.code_slot_8),
        )

        deviceId = DeviceId.get(this)
        Log.d(TAG, "DeviceId = $deviceId")

        // робимо короткий красивий код
        shortCode = buildShortCode(deviceId)

        startLogoAnimation()
        startHttpServer()
        startWsClient()
        showSplashThenStatus()
    }

    // ---------- UI / DESIGN ----------

    private fun startLogoAnimation() {
        val pulseAnim = AnimationUtils.loadAnimation(this, R.anim.logo_pulse)
        val logoImage = findViewById<ImageView>(R.id.logo_image)
        logoImage.startAnimation(pulseAnim)
    }

    private fun showSplashThenStatus() {
        splashContainer.visibility = View.VISIBLE
        statusContainer.visibility = View.GONE

        Handler(Looper.getMainLooper()).postDelayed({
            splashContainer.visibility = View.GONE
            statusContainer.visibility = View.VISIBLE
            updateNetworkInfo()
        }, 2000)
    }

    private fun buildShortCode(deviceId: String): String {
        // тепер deviceId вже 8-символьний, але лишимо логіку на майбутнє
        val clean = deviceId.replace("-", "").uppercase()
        if (clean.length >= 8) return clean.substring(0, 8)

        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val sb = StringBuilder(clean)
        var i = 0
        while (sb.length < 8) {
            sb.append(alphabet[i % alphabet.length])
            i++
        }
        return sb.toString()
    }

    private fun showCodeBubbles(code: String) {
        val chars = code.toCharArray()
        codeSlots.forEachIndexed { index, textView ->
            textView.text = if (index < chars.size) chars[index].toString() else ""
        }
    }

    private fun updateNetworkInfo() {
        if (!hasNetwork()) {
            statusTitle.text = "Нема з’єднання"
            infoText.text = "Підключись до Wi-Fi"
            connectHint.text = ""
            linkText.text = "Немає мережі"
            linkText.setTextColor(Color.parseColor("#FFCFFA"))
            codeHint.text = ""
            showCodeBubbles("")
            qrImage.setImageBitmap(null)
            return
        }

        // кольори
        val accent = Color.parseColor("#FFCFFA")
        val white = Color.parseColor("#FFFFFF")

        logoText.text = "nestify"
        logoText.setTextColor(accent)

        statusTitle.text = "Під'єднайте ваш пристрій"
        statusTitle.setTextColor(white)

        infoText.text = "Відскануйте QR-код"
        infoText.setTextColor(Color.parseColor("#E5E0ED"))

        connectHint.text = "Або перейдіть на сторінку:"
        linkText.text = "opencine.cloud/connect"
        linkText.setTextColor(accent)

        codeHint.text = "Введіть код:"
        codeHint.setTextColor(white)

        showCodeBubbles(shortCode)

        // QR → сторінка конекту з уже підставленим девайсом
        val url = "https://opencine.cloud/connect?device=$deviceId"
        qrImage.setImageBitmap(generateQr(url, 512))
    }

    private fun generateQr(text: String, size: Int): Bitmap {
        val writer = QRCodeWriter()

        // внутрішній QR без полів (він буде менший за контейнер)
        val innerSize = (size * 0.76f).toInt()  // 76% від загального
        val bitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, innerSize, innerSize)

        val qrRaw = Bitmap.createBitmap(innerSize, innerSize, Bitmap.Config.ARGB_8888)
        val fgColor = Color.parseColor("#F5ECFF")   // м’який біло-рожевий
        val bgColor = Color.TRANSPARENT

        for (x in 0 until innerSize) {
            for (y in 0 until innerSize) {
                qrRaw.setPixel(x, y, if (bitMatrix[x, y]) fgColor else bgColor)
            }
        }

        // Контейнер із заокругленими кутами
        val result = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        // Радіус як на макеті (доволі круглий)
        val radius = size * 0.22f

        val rect = RectF(0f, 0f, size.toFloat(), size.toFloat())
        val path = Path().apply {
            addRoundRect(rect, radius, radius, Path.Direction.CW)
        }

        // Кліпаємо усе по заокругленому прямокутнику
        canvas.clipPath(path)

        // фон прозорий
        canvas.drawColor(Color.TRANSPARENT)

        // Малюємо внутрішній QR із відступами
        val padding = (size * 0.12f).toInt()
        val dstRect = Rect(
            padding,
            padding,
            size - padding,
            size - padding
        )

        canvas.drawBitmap(qrRaw, null, dstRect, Paint(Paint.ANTI_ALIAS_FLAG))

        qrRaw.recycle()
        return result
    }

    // ---------- мережа ----------

    private fun hasNetwork(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    private fun getLocalIpAddress(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            for (intf in interfaces) {
                val addrs = intf.inetAddresses
                for (addr in addrs) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        return addr.hostAddress
                    }
                }
            }
        } catch (_: Exception) {
        }
        return null
    }

    // ---------- HTTP-сервер / WS-клієнт ----------

    private fun startHttpServer() {
        httpServer = RemoteHttpServer(serverPort, this, applicationContext).apply { start() }
    }

    private fun startWsClient() {
        val baseUrl = "wss://api.opencine.cloud"

        wsClient = PlayerWsClient(
            baseUrl = baseUrl,
            deviceId = deviceId,
            controller = this,
            statusProvider = { getStatus() },
            hubListener = this,
        ).also { it.connect() }
    }

    // ---------- PlayerHubListener ----------

    override fun onControllerConnected(profileName: String) {
        if (player != null) return  // відео грає — не чіпаємо UI
        val name = profileName.trim().ifEmpty { "Невідомий" }
        statusTitle.text = "Підключено"
        infoText.text = name
        connectHint.visibility = View.GONE
        linkText.visibility = View.GONE
        codeHint.visibility = View.GONE
        qrImage.visibility = View.GONE
        codeSlots.forEach { it.visibility = View.GONE }
    }

    override fun onControllerDisconnected() {
        if (player != null) return  // відео грає — не чіпаємо UI
        updateNetworkInfo()
        connectHint.visibility = View.VISIBLE
        linkText.visibility = View.VISIBLE
        codeHint.visibility = View.VISIBLE
        qrImage.visibility = View.VISIBLE
        codeSlots.forEach { it.visibility = View.VISIBLE }
    }

    private fun startWsProgress() {
        wsProgressHandler.removeCallbacks(wsProgressRunnable)
        wsProgressHandler.post(wsProgressRunnable)
    }

    private fun stopWsProgress() {
        wsProgressHandler.removeCallbacks(wsProgressRunnable)
    }

    // ---------- RemoteController ----------

    override fun playUrl(
        url: String,
        link: String?,
        originName: String?,
        title: String?,
        image: String?,
        movieId: String?,
        season: Int?,
        episode: Int?,
        userId: String?,
        startPositionMs: Long?
    ) {
        Log.d(
            TAG,
            "playUrl() movieId=$movieId userId=$userId season=$season episode=$episode startPositionMs=$startPositionMs"
        )

        runOnUiThread {
            currentLink = link
            currentOriginName = originName
            currentTitle = title
            currentImage = image
            currentMovieId = movieId
            currentSeason = season
            currentEpisode = episode
            currentUserId = userId

            statusContainer.visibility = View.GONE

            infoText.text = "Відтворюю відео"

            initPlayer(url, startPositionMs)

            startAmbient()
            startWsProgress()

            ProgressReporter.start { getStatus() }

            val st = getStatus()
            wsClient?.sendNotification("Player.OnPlay", st)
        }
    }

    override fun pause() {
        runOnUiThread {
            val p = player
            if (p != null) {
                p.playWhenReady = false
                infoText.text = "Пауза"
                val st = getStatus()
                wsClient?.sendNotification("Player.OnPause", st)
                ProgressReporter.reportImmediate(st)
            }
        }
    }

    override fun resume() {
        runOnUiThread {
            val p = player
            if (p != null) {
                p.playWhenReady = true
                infoText.text = "Відтворюю відео"
                val st = getStatus()
                wsClient?.sendNotification("Player.OnPlay", st)
            }
        }
    }

    override fun togglePlayPause() {
        runOnUiThread {
            val p = player
            if (p != null) {
                if (p.isPlaying) {
                    p.playWhenReady = false
                    infoText.text = "Пауза"
                    val st = getStatus()
                    wsClient?.sendNotification("Player.OnPause", st)
                    ProgressReporter.reportImmediate(st)
                } else {
                    p.playWhenReady = true
                    infoText.text = "Відтворюю відео"
                    val st = getStatus()
                    wsClient?.sendNotification("Player.OnPlay", st)
                }
            }
        }
    }

    override fun stopPlayback() {
        runOnUiThread {
            val stBeforeStop = getStatus()
            ProgressReporter.reportImmediate(stBeforeStop)

            releasePlayer()
            stopAmbient(sendOff = true)
            stopWsProgress()
            ProgressReporter.stop()

            statusContainer.visibility = View.VISIBLE
            updateNetworkInfo()

            currentLink = null
            currentOriginName = null
            currentTitle = null
            currentImage = null
            currentMovieId = null
            currentSeason = null
            currentEpisode = null
            currentUserId = null

            val st = getStatus()
            wsClient?.sendNotification("Player.OnStop", st)
        }
    }

    override fun seekTo(positionMs: Long) {
        runOnUiThread {
            player?.seekTo(positionMs)
            val st = getStatus()
            wsClient?.sendNotification("Player.OnSeek", st)
            ProgressReporter.reportImmediate(st)
        }
    }

    override fun setVolume(volumePercent: Int) {
        runOnUiThread {
            val vol = (volumePercent.coerceIn(0, 100) / 100f)
            player?.volume = vol
            showVolumeUi(volumePercent.coerceIn(0, 100))
            val st = getStatus()
            wsClient?.sendNotification("Application.OnVolume", st)
        }
    }

    override fun getStatus(): PlayerStatus {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return buildStatusOnMain()
        }

        var result: PlayerStatus? = null
        val latch = CountDownLatch(1)

        runOnUiThread {
            try {
                result = buildStatusOnMain()
            } finally {
                latch.countDown()
            }
        }

        latch.await(300, TimeUnit.MILLISECONDS)

        return result ?: PlayerStatus(
            positionMs = 0L,
            durationMs = 0L,
            isPlaying = false,
            volume = 100,
            link = currentLink,
            originName = currentOriginName,
            title = currentTitle,
            image = currentImage,
            movieId = currentMovieId,
            season = currentSeason,
            episode = currentEpisode,
            userId = currentUserId
        )
    }

    private fun buildStatusOnMain(): PlayerStatus {
        val p = player
        val position = p?.currentPosition ?: 0L
        val duration = p?.duration ?: 0L
        val isPlaying = (p?.isPlaying == true)
        val volPercent = ((p?.volume ?: 1f) * 100).toInt().coerceIn(0, 100)

        return PlayerStatus(
            positionMs = position,
            durationMs = duration,
            isPlaying = isPlaying,
            volume = volPercent,
            link = currentLink,
            originName = currentOriginName,
            title = currentTitle,
            image = currentImage,
            movieId = currentMovieId,
            season = currentSeason,
            episode = currentEpisode,
            userId = currentUserId
        )
    }

    // ---------- ExoPlayer ----------

    private fun initPlayer(url: String, startPositionMs: Long?) {
        Log.d(TAG, "initPlayer url=$url startPositionMs=$startPositionMs")
        player?.release()

        val exoPlayer = ExoPlayer.Builder(this).build()
        playerView.player = exoPlayer

        // Авто-стоп, коли фільм закінчився
        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    Log.d(TAG, "Playback ended → auto stop")
                    runOnUiThread {
                        stopPlayback()
                    }
                }
            }
        })

        val mediaItem = MediaItem.fromUri(url)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()

        if (startPositionMs != null && startPositionMs > 0L) {
            exoPlayer.seekTo(startPositionMs)
        }

        exoPlayer.playWhenReady = true
        player = exoPlayer
    }

    private fun releasePlayer() {
        playerView.player = null
        player?.release()
        player = null
    }

    // Раніше тут усе вбивалося — тому апка жила дуже мало.
    // Тепер в onStop нічого критичного не робимо.
    override fun onStop() {
        super.onStop()
        // можна максимум поставити на паузу, щоб не грало в фоні
        player?.playWhenReady = false
    }

    override fun onDestroy() {
        super.onDestroy()

        httpServer?.stop()
        httpServer = null

        ProgressReporter.stop()
        releasePlayer()
        stopAmbient(sendOff = true)
        stopWsProgress()

        wsClient?.close()
        wsClient = null

        currentLink = null
        currentOriginName = null
        currentTitle = null
        currentImage = null
        currentMovieId = null
        currentSeason = null
        currentEpisode = null
        currentUserId = null
    }

    // ---------- Ambient ----------

    private fun startAmbient() {
        if (!AmbientConfig.enabled) return
        if (AmbientConfig.wledIp.isBlank()) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        if (ambientRunning) return
        ambientRunning = true
        ambientHandler.post(ambientRunnable)
    }

    private fun stopAmbient(sendOff: Boolean) {
        ambientRunning = false
        ambientHandler.removeCallbacks(ambientRunnable)
        if (sendOff && AmbientConfig.enabled) {
            Thread { wledClient.turnOff() }.start()
        }
    }

    private fun captureAndSendAverageColor(surfaceView: SurfaceView) {
        // Беремо реальний розмір SurfaceView
        val w = surfaceView.width
        val h = surfaceView.height
        if (w <= 0 || h <= 0) return

        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)

        PixelCopy.request(
            surfaceView,
            bmp,
            { result ->
                try {
                    if (result == PixelCopy.SUCCESS) {
                        val (top, bottom) =
                            detectLetterboxVertical(bmp, AmbientConfig.blackBarLumaThreshold)

                        var rs = 0L
                        var gs = 0L
                        var bs = 0L
                        var count = 0

                        // Тут вже самі ріжемо до 32×18 в процесі проходу
                        val stepX = max(1, w / 32)
                        val stepY = max(1, (bottom - top + 1) / 18)

                        for (y in top..bottom step stepY) {
                            for (x in 0 until w step stepX) {
                                val c = bmp.getPixel(x, y)
                                rs += Color.red(c)
                                gs += Color.green(c)
                                bs += Color.blue(c)
                                count++
                            }
                        }

                        if (count > 0) {
                            val r = (rs / count).toInt().coerceIn(0, 255)
                            val g = (gs / count).toInt().coerceIn(0, 255)
                            val b = (bs / count).toInt().coerceIn(0, 255)
                            Thread { wledClient.sendColor(r, g, b) }.start()
                        }
                    } else {
                        // Якщо шо — просто скіпаємо, без крашу
                        Log.w(TAG, "PixelCopy failed with code=$result")
                    }
                } finally {
                    bmp.recycle()
                }
            },
            ambientHandler
        )
    }


    private fun detectLetterboxVertical(bmp: Bitmap, threshold: Int): Pair<Int, Int> {
        val w = bmp.width
        val h = bmp.height
        if (h <= 4) return 0 to (h - 1)

        fun rowLuma(y: Int): Double {
            var sum = 0.0
            var cnt = 0
            val step = max(1, w / 32)
            for (x in 0 until w step step) {
                val c = bmp.getPixel(x, y)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                val l = 0.2126 * r + 0.7152 * g + 0.0722 * b
                sum += l
                cnt++
            }
            return if (cnt == 0) 0.0 else sum / cnt
        }

        var top = 0
        var bottom = h - 1

        for (y in 0 until h / 3) {
            if (rowLuma(y) > threshold) {
                top = y
                break
            }
        }
        for (y in h - 1 downTo (2 * h) / 3) {
            if (rowLuma(y) > threshold) {
                bottom = y
                break
            }
        }

        if (bottom <= top) {
            top = 0
            bottom = h - 1
        }
        return top to bottom
    }

    // ---------- Пульт / клавіші ----------

    private fun seekBy(deltaMs: Long) {
        val p = player ?: return
        val duration = if (p.duration > 0) p.duration else Long.MAX_VALUE
        val newPos = (p.currentPosition + deltaMs)
            .coerceAtLeast(0L)
            .coerceAtMost(duration)

        p.seekTo(newPos)
        val st = getStatus()
        wsClient?.sendNotification("Player.OnSeek", st)
        ProgressReporter.reportImmediate(st)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {

                // Play/Pause / OK / Enter
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> {
                    togglePlayPause()
                    return true
                }

                // Вперед 15 сек
                KeyEvent.KEYCODE_DPAD_RIGHT,
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                    seekBy(15_000L)
                    return true
                }

                // Назад 15 сек
                KeyEvent.KEYCODE_DPAD_LEFT,
                KeyEvent.KEYCODE_MEDIA_REWIND -> {
                    seekBy(-15_000L)
                    return true
                }

                // Stop
                KeyEvent.KEYCODE_MEDIA_STOP -> {
                    stopPlayback()
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    // ---------- Volume overlay ----------

    private fun showVolumeUi(volumePercent: Int) {
        val root = findViewById<ViewGroup>(android.R.id.content) as? FrameLayout ?: return

        val tv = volumeOverlay ?: TextView(this).apply {
            textSize = 13f
            setTextColor(Color.parseColor("#F5F0FF"))
            setPadding(24, 10, 24, 10)
            background = PaintDrawableRounded(Color.parseColor("#1A1028D0"), 999f)
            alpha = 0.0f

            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = 64
                rightMargin = 48
            }
            root.addView(this, lp)
            volumeOverlay = this
        }

        tv.text = "Гучність: $volumePercent%"

        // плавно показати
        tv.animate().cancel()
        tv.animate()
            .alpha(1f)
            .setDuration(120)
            .start()

        // ховаємо через 1.2 секунди
        volumeUiHandler.removeCallbacksAndMessages(null)
        volumeUiHandler.postDelayed({
            volumeOverlay?.animate()
                ?.alpha(0f)
                ?.setDuration(250)
                ?.start()
        }, 1200)
    }

    // маленький helper для заокругленого фону
    private fun PaintDrawableRounded(color: Int, radius: Float): android.graphics.drawable.ShapeDrawable {
        val shape = android.graphics.drawable.ShapeDrawable(
            android.graphics.drawable.shapes.RoundRectShape(
                FloatArray(8) { radius },
                null,
                null
            )
        )
        shape.paint.color = color
        return shape
    }
}
