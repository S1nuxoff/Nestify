package com.nestify.nestifyplayer

import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Rect
import android.graphics.Paint
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CircleCrop
import com.bumptech.glide.request.RequestOptions
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity(), RemoteHttpServer.RemoteController, PlayerHubListener {

    private val TAG = "MainActivity"

    // ---------- State machine ----------
    private enum class AppState { SPLASH, DISCONNECTED, CONNECTED_IDLE, PLAYING }
    private var appState = AppState.SPLASH

    // ---------- Views ----------
    private lateinit var playerView: PlayerView
    private lateinit var splashContainer: LinearLayout
    private lateinit var screenDisconnected: LinearLayout
    private lateinit var screenConnected: LinearLayout

    // disconnected screen
    private lateinit var statusTitle: TextView
    private lateinit var infoText: TextView
    private lateinit var connectHint: TextView
    private lateinit var linkText: TextView
    private lateinit var codeHint: TextView
    private lateinit var qrImage: ImageView
    private lateinit var codeSlots: List<TextView>
    private lateinit var retryButton: Button

    // connected idle screen
    private lateinit var avatarImage: ImageView
    private lateinit var connectedProfileName: TextView

    // ---------- Services ----------
    private var player: ExoPlayer? = null
    private var httpServer: RemoteHttpServer? = null
    private var wsClient: PlayerWsClient? = null
    private val serverPort = 8888

    // ---------- Identity ----------
    private var deviceId: String = ""
    private var shortCode: String = ""

    // ---------- Current controller profile ----------
    private var controllerProfileName: String = ""
    private var controllerAvatarUrl: String = ""

    // ---------- Current playback meta ----------
    private var currentLink: String? = null
    private var currentOriginName: String? = null
    private var currentTitle: String? = null
    private var currentImage: String? = null
    private var currentMovieId: String? = null
    private var currentSeason: Int? = null
    private var currentEpisode: Int? = null
    private var currentUserId: String? = null

    // preserve play state across onStop/onStart
    private var playerWasPlaying = false

    // player overlay views (found inside PlayerView after initPlayer)
    private var playerTitleView: TextView? = null
    private var playerSubtitleView: TextView? = null

    private val wsProgressHandler = Handler(Looper.getMainLooper())
    private val wsProgressRunnable = object : Runnable {
        override fun run() {
            if (player != null) {
                val st = getStatus()
                wsClient?.sendNotification("Player.OnProgress", st)
                wsProgressHandler.postDelayed(this, 3000L)
            }
        }
    }

    // UI для гучності
    private val volumeUiHandler = Handler(Looper.getMainLooper())
    private var volumeOverlay: TextView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        playerView       = findViewById(R.id.player_view)
        splashContainer  = findViewById(R.id.splash_container)
        screenDisconnected = findViewById(R.id.screen_disconnected)
        screenConnected  = findViewById(R.id.screen_connected)

        statusTitle  = findViewById(R.id.status_title)
        infoText     = findViewById(R.id.info_text)
        connectHint  = findViewById(R.id.connect_hint)
        linkText     = findViewById(R.id.link_text)
        codeHint     = findViewById(R.id.code_hint)
        qrImage      = findViewById(R.id.qr_image)
        retryButton  = findViewById(R.id.btn_retry)
        retryButton.setOnClickListener { refreshDisconnectedScreen() }

        avatarImage          = findViewById(R.id.avatar_image)
        connectedProfileName = findViewById(R.id.connected_profile_name)

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

        deviceId   = DeviceId.get(this)
        shortCode  = buildShortCode(deviceId)
        Log.d(TAG, "DeviceId = $deviceId")

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
        setState(AppState.SPLASH)
        Handler(Looper.getMainLooper()).postDelayed({
            setState(AppState.DISCONNECTED)
        }, 2000)
    }

    /**
     * Єдина точка зміни екрану.
     * Викликати тільки з Main thread.
     */
    private fun setState(newState: AppState) {
        appState = newState
        Log.d(TAG, "setState → $newState")

        splashContainer.visibility    = View.GONE
        screenDisconnected.visibility = View.GONE
        screenConnected.visibility    = View.GONE
        // player_view завжди під усіма — показується коли PLAYING
        playerView.visibility = if (newState == AppState.PLAYING) View.VISIBLE else View.GONE

        when (newState) {
            AppState.SPLASH -> {
                splashContainer.visibility = View.VISIBLE
            }

            AppState.DISCONNECTED -> {
                screenDisconnected.visibility = View.VISIBLE
                refreshDisconnectedScreen()
            }

            AppState.CONNECTED_IDLE -> {
                screenConnected.visibility = View.VISIBLE
                refreshConnectedScreen()
            }

            AppState.PLAYING -> {
                // player_view вже visible
            }
        }
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

    private fun refreshDisconnectedScreen() {
        if (!hasNetwork()) {
            statusTitle.text = "Нема з’єднання"
            statusTitle.setTextColor(Color.parseColor("#FFFFFF"))
            infoText.text = "Підключіть пристрій до Wi-Fi"
            infoText.setTextColor(Color.parseColor("#B0A8BB"))
            connectHint.text = ""
            linkText.text = ""
            codeHint.text = ""
            showCodeBubbles("")
            qrImage.setImageBitmap(null)
            retryButton.visibility = View.VISIBLE
            return
        }

        retryButton.visibility = View.GONE

        val accent = Color.parseColor("#FFCFFA")
        val white  = Color.parseColor("#FFFFFF")

        statusTitle.text = "Під’єднайте ваш пристрій"
        statusTitle.setTextColor(white)
        infoText.text = "Відскануйте QR-код"
        infoText.setTextColor(Color.parseColor("#E5E0ED"))
        connectHint.text = "Або перейдіть на сторінку:"
        linkText.text = "opencine.cloud/connect"
        linkText.setTextColor(accent)
        codeHint.text = "Введіть код:"
        codeHint.setTextColor(white)
        showCodeBubbles(shortCode)

        val url = "https://opencine.cloud/connect?device=$deviceId"
        qrImage.setImageBitmap(generateQr(url, 512))

        // Якщо WS не підключений — перепідключаємо
        wsClient?.connect()
    }

    private fun refreshConnectedScreen() {
        val name = controllerProfileName.trim().ifEmpty { "Профіль" }
        connectedProfileName.text = name

        if (controllerAvatarUrl.isNotBlank()) {
            Glide.with(this)
                .load(controllerAvatarUrl)
                .apply(RequestOptions().transform(CircleCrop()))
                .into(avatarImage)
        } else {
            avatarImage.setImageDrawable(null)
        }
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
        wsClient = PlayerWsClient(
            baseUrl = BuildConfig.WS_BASE_URL,
            deviceId = deviceId,
            controller = this,
            statusProvider = { getStatus() },
            hubListener = this,
        ).also { it.connect() }
    }

    // ---------- PlayerHubListener ----------

    override fun onControllerConnected(profileName: String) {
        onControllerConnectedWithAvatar(profileName, "")
    }

    override fun onControllerConnectedWithAvatar(profileName: String, avatarUrl: String) {
        controllerProfileName = profileName
        controllerAvatarUrl   = avatarUrl
        // Переходимо в CONNECTED_IDLE тільки якщо зараз не грає фільм
        runOnUiThread {
            if (appState != AppState.PLAYING) {
                transitionTo(AppState.CONNECTED_IDLE)
            }
        }
    }

    override fun onControllerDisconnected() {
        controllerProfileName = ""
        controllerAvatarUrl   = ""
        runOnUiThread {
            if (appState != AppState.PLAYING) {
                transitionTo(AppState.DISCONNECTED)
            }
            // Якщо гравець грає — зупиняємо і переходимо до disconnected
            // (на розсуд: можна лишати грати)
        }
    }

    /** Плавний fade-перехід між екранами */
    private fun transitionTo(newState: AppState) {
        val current = when (appState) {
            AppState.DISCONNECTED   -> screenDisconnected
            AppState.CONNECTED_IDLE -> screenConnected
            AppState.PLAYING        -> null
            AppState.SPLASH         -> splashContainer
        }

        current?.animate()?.alpha(0f)?.setDuration(250)?.withEndAction {
            current.alpha = 1f
            setState(newState)
            val next = when (newState) {
                AppState.DISCONNECTED   -> screenDisconnected
                AppState.CONNECTED_IDLE -> screenConnected
                else -> null
            }
            next?.alpha = 0f
            next?.animate()?.alpha(1f)?.setDuration(350)?.start()
        }?.start() ?: run {
            setState(newState)
        }
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
            currentLink       = link
            currentOriginName = originName
            currentTitle      = title
            currentImage      = image
            currentMovieId    = movieId
            currentSeason     = season
            currentEpisode    = episode
            currentUserId     = userId

            setState(AppState.PLAYING)
            initPlayer(url, startPositionMs)
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
            stopWsProgress()
            ProgressReporter.stop()

            currentLink       = null
            currentOriginName = null
            currentTitle      = null
            currentImage      = null
            currentMovieId    = null
            currentSeason     = null
            currentEpisode    = null
            currentUserId     = null

            // Якщо контролер ще підключений — показуємо idle, інакше disconnected
            val nextState = if (controllerProfileName.isNotEmpty())
                AppState.CONNECTED_IDLE
            else
                AppState.DISCONNECTED
            setState(nextState)

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

        val exoPlayer = ExoPlayer.Builder(this)
            .setSeekBackIncrementMs(15_000)
            .setSeekForwardIncrementMs(15_000)
            .build()
        playerView.player = exoPlayer

        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_ENDED -> {
                        Log.d(TAG, "Playback ended → auto stop")
                        runOnUiThread { stopPlayback() }
                    }
                    Player.STATE_READY -> {
                        // Щойно ExoPlayer готовий — seekTo вже відпрацював,
                        // оновлюємо lastSentPosMs щоб перший tick не звітував 0
                        ProgressReporter.syncPosition(exoPlayer.currentPosition)
                    }
                    else -> {}
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.e(TAG, "Player error: ${error.message}", error)
                runOnUiThread { showPlayerError(error.message ?: "Помилка відтворення") }
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

        // Bind custom title views inside the controller overlay
        playerTitleView    = playerView.findViewById(R.id.player_title)
        playerSubtitleView = playerView.findViewById(R.id.player_subtitle)
        updatePlayerTitle()
    }

    private fun updatePlayerTitle() {
        val title = currentTitle?.takeIf { it.isNotBlank() }
            ?: currentOriginName?.takeIf { it.isNotBlank() }
            ?: ""
        playerTitleView?.text = title

        val s = currentSeason
        val e = currentEpisode
        val episodeText = if (s != null && e != null) "Сезон $s  •  Серія $e" else null
        if (episodeText != null) {
            playerSubtitleView?.text = episodeText
            playerSubtitleView?.visibility = View.VISIBLE
        } else {
            playerSubtitleView?.visibility = View.GONE
        }
    }

    private fun releasePlayer() {
        playerView.player = null
        player?.release()
        player = null
    }

    override fun onStart() {
        super.onStart()
        val p = player ?: return
        // Повертаємо плеєр до PlayerView — без цього після повернення в апп
        // ExoPlayer не прив'язується до нового Surface і відео не відображається
        playerView.player = p
        if (playerWasPlaying) p.playWhenReady = true
    }

    override fun onStop() {
        super.onStop()
        playerWasPlaying = player?.isPlaying == true
        player?.playWhenReady = false
        // Від'єднуємо від Surface щоб уникнути "аудіо є, відео нема" після повернення
        playerView.player = null
    }

    override fun onDestroy() {
        super.onDestroy()

        httpServer?.stop()
        httpServer = null

        ProgressReporter.stop()
        releasePlayer()
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

    // ---------- Помилка плеєра ----------

    private fun showPlayerError(message: String) {
        Log.e(TAG, "showPlayerError: $message")
        // Зупиняємо все
        releasePlayer()
        stopWsProgress()
        ProgressReporter.stop()

        val nextState = if (controllerProfileName.isNotEmpty()) AppState.CONNECTED_IDLE else AppState.DISCONNECTED
        setState(nextState)

        // Показуємо тост
        android.widget.Toast.makeText(this, "Помилка: $message", android.widget.Toast.LENGTH_LONG).show()

        val st = getStatus()
        wsClient?.sendNotification("Player.OnStop", st)

        currentLink = null; currentOriginName = null; currentTitle = null
        currentImage = null; currentMovieId = null; currentSeason = null
        currentEpisode = null; currentUserId = null
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

                // Back під час перегляду — зупиняємо, не виходимо з апки
                KeyEvent.KEYCODE_BACK -> {
                    if (appState == AppState.PLAYING) {
                        stopPlayback()
                        return true
                    }
                    // в інших станах — стандартна поведінка (мінімізує апку)
                }

                // Play/Pause / OK / Enter
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> {
                    if (appState == AppState.PLAYING) {
                        togglePlayPause()
                        return true
                    }
                }

                // Вперед 15 сек
                KeyEvent.KEYCODE_DPAD_RIGHT,
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                    if (appState == AppState.PLAYING) {
                        seekBy(15_000L)
                        return true
                    }
                }

                // Назад 15 сек
                KeyEvent.KEYCODE_DPAD_LEFT,
                KeyEvent.KEYCODE_MEDIA_REWIND -> {
                    if (appState == AppState.PLAYING) {
                        seekBy(-15_000L)
                        return true
                    }
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
