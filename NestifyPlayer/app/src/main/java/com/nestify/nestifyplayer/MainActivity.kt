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
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.viewpager2.widget.ViewPager2
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CircleCrop
import com.bumptech.glide.request.RequestOptions
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity(), RemoteHttpServer.RemoteController, PlayerHubListener {

    private val TAG = "MainActivity"

    // ---------- State machine ----------
    private enum class AppState {
        SPLASH, AUTH, PROFILE_PICKER, DISCONNECTED, CONNECTED_IDLE, CONNECTED_DETAILS, CONNECTED_SELECTION, PLAYING
    }
    private var appState = AppState.SPLASH

    // ---------- Views ----------
    private lateinit var playerView: PlayerView
    private lateinit var splashContainer: LinearLayout
    private lateinit var screenDisconnected: FrameLayout
    private lateinit var screenConnected: FrameLayout

    // disconnected screen
    private lateinit var statusTitle: TextView
    private lateinit var infoText: TextView
    private lateinit var retryButton: Button
    private lateinit var disconnectedProfileBar: LinearLayout
    private lateinit var disconnectedAvatar: ImageView
    private lateinit var disconnectedProfileName: TextView

    // auth screen
    private lateinit var screenAuth: View
    private lateinit var screenProfilePicker: View
    private lateinit var authEmail: EditText
    private lateinit var authPassword: EditText
    private lateinit var authBtnLogin: Button
    private lateinit var authError: TextView
    private lateinit var authQrImage: ImageView
    private lateinit var authQrStatus: TextView
    private lateinit var profilesRow: LinearLayout

    // connected idle screen
    private lateinit var avatarImage: ImageView
    private lateinit var connectedProfileName: TextView
    private lateinit var featuredPager: ViewPager2
    private lateinit var sliderLoading: LinearLayout
    private lateinit var slideDots: LinearLayout
    private lateinit var profilePill: LinearLayout
    private lateinit var pillAvatar: ImageView
    private lateinit var pillName: TextView
    private lateinit var pillActions: LinearLayout
    private lateinit var movieDetailsOverlay: FrameLayout
    private lateinit var movieDetailsPoster: ImageView
    private lateinit var movieDetailsTitle: TextView
    private lateinit var movieDetailsMeta: TextView
    private lateinit var movieDetailsGenres: TextView
    private lateinit var movieDetailsOverview: TextView
    private lateinit var movieDetailsWatchButton: Button
    private lateinit var movieDetailsStatus: TextView
    private lateinit var selectionOverlay: FrameLayout
    private lateinit var selectionTitle: TextView
    private lateinit var selectionSubtitle: TextView
    private lateinit var selectionList: LinearLayout
    private var pillExpanded = false

    // ---------- Services ----------
    private var player: ExoPlayer? = null
    private var httpServer: RemoteHttpServer? = null
    private var wsClient: PlayerWsClient? = null
    private val serverPort = 8888

    // ---------- Identity ----------
    private var deviceId: String = ""

    // ---------- Current controller profile ----------
    private var controllerProfileName: String = ""
    private var controllerAvatarUrl: String = ""
    private var controllerUserId: String = ""

    // ---------- Auth flow ----------
    private var pendingAuthToken: String = ""
    private var pendingAccountId: Int = -1
    private var qrPollJob: Job? = null

    // ---------- Featured slider ----------
    private val sliderAutoHandler = Handler(Looper.getMainLooper())
    private var sliderJob: Job? = null
    private var sliderItems: List<FeaturedItem> = emptyList()
    private val ioScope = CoroutineScope(Dispatchers.IO)

    // ---------- Disconnect grace period ----------
    private val disconnectHandler = Handler(Looper.getMainLooper())
    private val disconnectRunnable = Runnable {
        if (appState != AppState.PLAYING) {
            transitionTo(AppState.DISCONNECTED)
        }
    }

    // ---------- Current playback meta ----------
    private var currentLink: String? = null
    private var currentOriginName: String? = null
    private var currentTitle: String? = null
    private var currentImage: String? = null
    private var currentMovieId: String? = null
    private var currentSeason: Int? = null
    private var currentEpisode: Int? = null
    private var currentUserId: String? = null
    private var currentTorrentHash: String? = null
    private var currentTorrentFileId: Int? = null
    private var currentTorrentFname: String? = null
    private var currentTorrentMagnet: String? = null
    private var selectedFeaturedItem: FeaturedItem? = null
    private var detailsPlayJob: Job? = null
    private var selectionButtons: List<Button> = emptyList()

    // preserve play state across onStop/onStart
    private var playerWasPlaying = false

    // cache last known status for getStatus() fallback
    @Volatile private var lastKnownStatus: PlayerStatus? = null

    // player overlay views (found inside PlayerView after initPlayer)
    private var playerTitleView: TextView? = null
    private var playerSubtitleView: TextView? = null

    private val wsProgressHandler = Handler(Looper.getMainLooper())
    private val wsProgressRunnable = object : Runnable {
        override fun run() {
            if (player != null && appState == AppState.PLAYING) {
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

        statusTitle = findViewById(R.id.status_title)
        infoText    = findViewById(R.id.info_text)
        retryButton = findViewById(R.id.btn_retry)
        retryButton.setOnClickListener { refreshDisconnectedScreen() }

        disconnectedProfileBar  = findViewById(R.id.disconnected_profile_bar)
        disconnectedAvatar      = findViewById(R.id.disconnected_avatar)
        disconnectedProfileName = findViewById(R.id.disconnected_profile_name)
        findViewById<Button>(R.id.btn_switch_profile).setOnClickListener { switchProfile() }
        findViewById<Button>(R.id.btn_logout).setOnClickListener { logout() }

        avatarImage          = findViewById(R.id.avatar_image)
        connectedProfileName = findViewById(R.id.connected_profile_name)
        featuredPager        = findViewById(R.id.featured_pager)
        sliderLoading        = findViewById(R.id.slider_loading)
        slideDots            = findViewById(R.id.slide_dots)
        profilePill          = findViewById(R.id.profile_pill)
        pillAvatar           = findViewById(R.id.pill_avatar)
        pillName             = findViewById(R.id.pill_name)
        pillActions          = profilePill.findViewById(R.id.pill_actions)
        movieDetailsOverlay  = findViewById(R.id.movie_details_overlay)
        movieDetailsPoster   = findViewById(R.id.movie_details_poster)
        movieDetailsTitle    = findViewById(R.id.movie_details_title)
        movieDetailsMeta     = findViewById(R.id.movie_details_meta)
        movieDetailsGenres   = findViewById(R.id.movie_details_genres)
        movieDetailsOverview = findViewById(R.id.movie_details_overview)
        movieDetailsWatchButton = findViewById(R.id.movie_details_watch_btn)
        movieDetailsStatus   = findViewById(R.id.movie_details_status)
        selectionOverlay     = findViewById(R.id.selection_overlay)
        selectionTitle       = findViewById(R.id.selection_title)
        selectionSubtitle    = findViewById(R.id.selection_subtitle)
        selectionList        = findViewById(R.id.selection_list)
        // Pill: UP to focus, CENTER to expand, LEFT/RIGHT to pick button, CENTER to confirm
        val pillBtnSwitch = profilePill.findViewById<Button>(R.id.pill_btn_switch)
        val pillBtnLogout = profilePill.findViewById<Button>(R.id.pill_btn_logout)
        pillBtnSwitch.setOnClickListener { switchProfile() }
        pillBtnLogout.setOnClickListener { logout() }
        movieDetailsWatchButton.setOnClickListener { selectedFeaturedItem?.let { playFeaturedItem(it) } }

        // Collapse pill when focus leaves pill hierarchy entirely
        val collapseFocusListener = View.OnFocusChangeListener { _, _ ->
            profilePill.post {
                if (!isPillHierarchyFocused()) collapsePill()
            }
        }
        profilePill.onFocusChangeListener = collapseFocusListener
        pillBtnSwitch.onFocusChangeListener = collapseFocusListener
        pillBtnLogout.onFocusChangeListener = collapseFocusListener

        screenAuth          = findViewById(R.id.screen_auth)
        screenProfilePicker = findViewById(R.id.screen_profile_picker)
        authEmail           = screenAuth.findViewById(R.id.auth_email)
        authPassword        = screenAuth.findViewById(R.id.auth_password)
        authBtnLogin        = screenAuth.findViewById(R.id.auth_btn_login)
        authError           = screenAuth.findViewById(R.id.auth_error)
        authQrImage         = screenAuth.findViewById(R.id.auth_qr)
        authQrStatus        = screenAuth.findViewById(R.id.auth_qr_status)
        profilesRow         = screenProfilePicker.findViewById(R.id.profiles_row)

        deviceId = DeviceId.get(this)
        Log.d(TAG, "DeviceId = $deviceId")

        setupAuthScreen()
        startLogoAnimation()
        startHttpServer()
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
            val token = TvSession.getAuthToken(this)
            if (token != null) {
                ioScope.launch {
                    val valid = TvApiClient.validateToken(BuildConfig.BACKEND_BASE_URL, token)
                    runOnUiThread {
                        if (valid) {
                            // Use saved profile to go directly to slider
                            initControllerFromSession()
                            ensureWsClientConnected()
                            transitionTo(AppState.CONNECTED_IDLE)
                        } else {
                            wsClient?.close()
                            wsClient = null
                            TvSession.clear(this@MainActivity)
                            setState(AppState.AUTH)
                        }
                    }
                }
            } else {
                setState(AppState.AUTH)
            }
        }, 2000)
    }

    /** Populate controller identity fields from saved TvSession (used on cold start). */
    private fun initControllerFromSession() {
        val name = TvSession.getProfileName(this)
        val avatarPath = TvSession.getProfileAvatar(this)
        val profileId = TvSession.getProfileId(this)
        controllerProfileName = name
        controllerAvatarUrl = if (avatarPath != null) {
            if (avatarPath.startsWith("http")) avatarPath else "${BuildConfig.BACKEND_BASE_URL}$avatarPath"
        } else ""
        controllerUserId = if (profileId > 0) profileId.toString() else ""
    }

    /**
     * Єдина точка зміни екрану.
     * Викликати тільки з Main thread.
     */
    private fun setState(newState: AppState) {
        appState = newState
        Log.d(TAG, "setState → $newState")

        splashContainer.visibility     = View.GONE
        screenDisconnected.visibility  = View.GONE
        screenConnected.visibility     = View.GONE
        screenAuth.visibility          = View.GONE
        screenProfilePicker.visibility = View.GONE
        // player_view завжди під усіма — показується коли PLAYING
        playerView.visibility = if (newState == AppState.PLAYING) View.VISIBLE else View.GONE

        when (newState) {
            AppState.SPLASH -> {
                splashContainer.visibility = View.VISIBLE
            }

            AppState.AUTH -> {
                screenAuth.visibility = View.VISIBLE
                startQrAuth()
            }

            AppState.PROFILE_PICKER -> {
                screenProfilePicker.visibility = View.VISIBLE
            }

            AppState.DISCONNECTED -> {
                screenDisconnected.visibility = View.VISIBLE
                refreshDisconnectedScreen()
            }

            AppState.CONNECTED_IDLE -> {
                screenConnected.visibility = View.VISIBLE
                movieDetailsOverlay.visibility = View.GONE
                selectionOverlay.visibility = View.GONE
                refreshConnectedScreen()
                // Give focus to profile pill so remote can navigate to it
                profilePill.post { profilePill.requestFocus() }
            }

            AppState.CONNECTED_DETAILS -> {
                screenConnected.visibility = View.VISIBLE
                movieDetailsOverlay.visibility = View.VISIBLE
                selectionOverlay.visibility = View.GONE
                movieDetailsWatchButton.post { movieDetailsWatchButton.requestFocus() }
            }

            AppState.CONNECTED_SELECTION -> {
                screenConnected.visibility = View.VISIBLE
                movieDetailsOverlay.visibility = View.GONE
                selectionOverlay.visibility = View.VISIBLE
                selectionButtons.firstOrNull()?.let { btn ->
                    btn.post { btn.requestFocus() }
                }
            }

            AppState.PLAYING -> {
                stopAutoScroll()
                // player_view вже visible
            }
        }
    }

    private fun refreshDisconnectedScreen() {
        if (!hasNetwork()) {
            statusTitle.text = "Нема з’єднання"
            infoText.text = "Підключіть пристрій до Wi-Fi"
            retryButton.visibility = View.VISIBLE
            disconnectedProfileBar.visibility = View.GONE
            return
        }
        retryButton.visibility = View.GONE
        statusTitle.text = "Очікуємо підключення"
        infoText.text = "Відкрийте Nestify на телефоні та натисніть «Дивитись на ТВ»"

        // Show profile bar if logged in
        val profileName = TvSession.getProfileName(this)
        if (profileName.isNotBlank()) {
            disconnectedProfileName.text = profileName
            val avatarPath = TvSession.getProfileAvatar(this)
            val avatarUrl = if (avatarPath != null) {
                if (avatarPath.startsWith("http")) avatarPath
                else "${BuildConfig.BACKEND_BASE_URL}$avatarPath"
            } else null
            if (avatarUrl != null) {
                Glide.with(this).load(avatarUrl)
                    .apply(RequestOptions().transform(CircleCrop()))
                    .into(disconnectedAvatar)
            }
            disconnectedProfileBar.visibility = View.VISIBLE
        } else {
            disconnectedProfileBar.visibility = View.GONE
        }

        if (TvSession.isLoggedIn(this)) {
            ensureWsClientConnected()
            wsClient?.connect()
        }
    }

    private fun navigatePillButtons(forward: Boolean) {
        val btnSwitch = profilePill.findViewById<Button>(R.id.pill_btn_switch)
        val btnLogout = profilePill.findViewById<Button>(R.id.pill_btn_logout)
        val focused = currentFocus
        when {
            focused == btnSwitch -> btnLogout.requestFocus()
            focused == btnLogout -> btnSwitch.requestFocus()
            else -> btnSwitch.requestFocus()
        }
    }

    private fun isPillHierarchyFocused(): Boolean {
        val f = currentFocus ?: return false
        return f == profilePill ||
               f.id == R.id.pill_btn_switch ||
               f.id == R.id.pill_btn_logout
    }

    private fun togglePill() {
        if (pillExpanded) collapsePill() else expandPill()
    }

    private fun expandPill() {
        pillExpanded = true
        pillActions.visibility = View.VISIBLE
        pillActions.alpha = 0f
        pillActions.animate().alpha(1f).setDuration(180).start()
    }

    private fun collapsePill() {
        pillExpanded = false
        pillActions.animate().alpha(0f).setDuration(150).withEndAction {
            pillActions.visibility = View.GONE
        }.start()
    }

    private fun switchProfile() {
        val token = TvSession.getAuthToken(this) ?: run { logout(); return }
        ioScope.launch {
            val profiles = TvApiClient.fetchProfiles(BuildConfig.BACKEND_BASE_URL, token)
            runOnUiThread {
                if (profiles.isEmpty()) {
                    logout()
                } else {
                    // Reuse pendingAuthToken so finishLogin can save correctly
                    pendingAuthToken = token
                    pendingAccountId = TvSession.getAccountId(this@MainActivity)
                    showProfilePicker(profiles)
                }
            }
        }
    }

    private fun logout() {
        stopQrPolling()
        val authToken = TvSession.getAuthToken(this)
        val currentDeviceId = deviceId
        wsClient?.close()
        wsClient = null
        TvSession.clear(this)
        controllerProfileName = ""
        controllerAvatarUrl = ""
        controllerUserId = ""
        pendingAuthToken = ""
        pendingAccountId = -1
        transitionTo(AppState.AUTH)

        if (!authToken.isNullOrBlank()) {
            ioScope.launch {
                TvApiClient.logoutDevice(BuildConfig.BACKEND_BASE_URL, authToken, currentDeviceId)
            }
        }
    }

    private fun refreshConnectedScreen() {
        val name = controllerProfileName.trim().ifEmpty { "Профіль" }
        connectedProfileName.text = name
        pillName.text = name

        // Loading placeholder avatar
        if (controllerAvatarUrl.isNotBlank()) {
            Glide.with(this).load(controllerAvatarUrl)
                .apply(RequestOptions().transform(CircleCrop()))
                .into(avatarImage)
            Glide.with(this).load(controllerAvatarUrl)
                .apply(RequestOptions().transform(CircleCrop()))
                .into(pillAvatar)
        } else {
            avatarImage.setImageDrawable(null)
            pillAvatar.setImageDrawable(null)
        }

        // Show loading state, hide slider
        sliderLoading.visibility = View.VISIBLE
        featuredPager.visibility = View.GONE
        slideDots.visibility = View.GONE
        profilePill.visibility = View.GONE

        // Load recommendations in background
        loadFeaturedSlider()
    }

    private fun loadFeaturedSlider() {
        sliderJob?.cancel()
        val userId = controllerUserId
        val backendUrl = BuildConfig.BACKEND_BASE_URL

        sliderJob = ioScope.launch {
            val items = FeaturedDataSource.load(userId, backendUrl)
            runOnUiThread {
                if (appState != AppState.CONNECTED_IDLE) return@runOnUiThread
                if (items.isEmpty()) {
                    // No data — hide spinner, show static idle message
                    sliderLoading.visibility = View.VISIBLE
                    connectedProfileName.text = controllerProfileName.trim().ifEmpty { "Профіль" }
                    val hint = sliderLoading.getChildAt(2) as? TextView
                    hint?.text = "Оберіть фільм і натисніть «Дивитись»"
                    return@runOnUiThread
                }
                sliderItems = items
                setupSlider(items)
            }
        }
    }

    private fun setupSlider(items: List<FeaturedItem>) {
        // Adapter
        val adapter = FeaturedSliderAdapter(items) { item -> openMovieDetails(item) }
        featuredPager.adapter = adapter
        featuredPager.offscreenPageLimit = 2

        // Dots
        buildDots(items.size, 0)

        featuredPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                buildDots(items.size, position)
                resetAutoScroll(items.size)
            }
        })

        // Show slider, hide loading
        sliderLoading.visibility = View.GONE
        featuredPager.visibility = View.VISIBLE
        slideDots.visibility = View.VISIBLE
        profilePill.visibility = View.VISIBLE

        startAutoScroll(items.size)
    }

    private fun openMovieDetails(item: FeaturedItem) {
        selectedFeaturedItem = item
        stopAutoScroll()
        movieDetailsTitle.text = item.title
        movieDetailsGenres.text = item.genres.joinToString("  ·  ")
        movieDetailsGenres.visibility = if (item.genres.isEmpty()) View.GONE else View.VISIBLE
        val metaParts = listOfNotNull(
            item.year.takeIf { it.isNotBlank() },
            item.rating.takeIf { it.isNotBlank() }?.let { "★ $it" },
            if (item.mediaType == "tv") "Серіал" else "Фільм",
        )
        movieDetailsMeta.text = metaParts.joinToString("  ·  ")
        movieDetailsOverview.text = item.overview.ifBlank {
            if (item.mediaType == "tv") {
                "Запуск почне перегляд із першого доступного епізоду."
            } else {
                "Готово до перегляду на цьому телевізорі."
            }
        }
        movieDetailsStatus.text = ""
        movieDetailsStatus.visibility = View.GONE
        movieDetailsWatchButton.isEnabled = true
        val imageUrl = item.posterUrl ?: item.backdropUrl
        if (imageUrl != null) {
            Glide.with(this).load(imageUrl).centerCrop().into(movieDetailsPoster)
        } else {
            movieDetailsPoster.setImageDrawable(null)
        }
        transitionTo(AppState.CONNECTED_DETAILS)
    }

    private fun closeMovieDetails() {
        detailsPlayJob?.cancel()
        movieDetailsOverlay.visibility = View.GONE
        selectedFeaturedItem = null
        transitionTo(AppState.CONNECTED_IDLE)
        featuredPager.post { featuredPager.requestFocus() }
        resetAutoScroll(sliderItems.size)
    }

    private fun playFeaturedItem(item: FeaturedItem) {
        detailsPlayJob?.cancel()
        movieDetailsWatchButton.isEnabled = false
        movieDetailsStatus.visibility = View.VISIBLE
        movieDetailsStatus.text = "Шукаємо торенти…"

        detailsPlayJob = ioScope.launch {
            val torrents = TvApiClient.searchTorrents(
                baseUrl = BuildConfig.BACKEND_BASE_URL,
                title = item.title,
                year = item.year,
                tmdbId = item.tmdbId,
                mediaType = item.mediaType,
            )
            val rankedTorrents = rankTorrents(torrents)
            if (rankedTorrents.isEmpty()) {
                runOnUiThread {
                    movieDetailsStatus.text = "Нічого не знайдено"
                    movieDetailsWatchButton.isEnabled = true
                }
                return@launch
            }

            runOnUiThread {
                movieDetailsStatus.text = ""
                movieDetailsStatus.visibility = View.GONE
                movieDetailsWatchButton.isEnabled = true
                showTorrentSelection(item, rankedTorrents)
            }
        }
    }

    private fun rankTorrents(items: List<TvApiClient.TorrentCandidate>): List<TvApiClient.TorrentCandidate> {
        return items.sortedByDescending { torrent ->
            var score = 0
            score += when (torrent.lang) {
                "uk" -> 400
                "en" -> 250
                "pl" -> 150
                "ru" -> 50
                else -> 0
            }
            score += when (torrent.quality?.uppercase()) {
                "4K" -> 120
                "1080P" -> 100
                "720P" -> 70
                "480P" -> 30
                else -> 40
            }
            score += torrent.seeders.coerceAtMost(100) * 3
            score += torrent.peers.coerceAtMost(50)
            if (torrent.title.contains("REMUX", ignoreCase = true)) score += 20
            if (torrent.title.contains("WEB-DL", ignoreCase = true)) score += 12
            if (torrent.title.contains("UHD", ignoreCase = true)) score += 10
            score
        }
    }

    private fun showTorrentSelection(
        item: FeaturedItem,
        torrents: List<TvApiClient.TorrentCandidate>,
    ) {
        selectionTitle.text = item.title
        selectionSubtitle.text = "Оберіть торрент"
        selectionList.removeAllViews()

        selectionButtons = torrents.take(12).map { torrent ->
            buildSelectionButton(
                title = buildString {
                    append(torrent.title.ifBlank { "Torrent" })
                    if (!torrent.quality.isNullOrBlank()) append("  ·  ${torrent.quality}")
                },
                subtitle = buildString {
                    append(torrent.lang.uppercase())
                    append("  ·  ↑${torrent.seeders}")
                    if (torrent.size > 0) append("  ·  ${formatBytes(torrent.size)}")
                }
            ) {
                selectTorrent(item, torrent)
            }
        }

        selectionButtons.forEach { selectionList.addView(it) }
        transitionTo(AppState.CONNECTED_SELECTION)
    }

    private fun selectTorrent(
        item: FeaturedItem,
        torrent: TvApiClient.TorrentCandidate,
    ) {
        selectionTitle.text = item.title
        selectionSubtitle.text = "Підготовка файлів…"
        selectionButtons.forEach { it.isEnabled = false }

        detailsPlayJob?.cancel()
        detailsPlayJob = ioScope.launch {
            val added = TvApiClient.addTorrent(
                baseUrl = BuildConfig.BACKEND_BASE_URL,
                magnet = torrent.magnet,
                title = "[Nestify TV] ${item.title}",
                poster = item.posterUrl ?: "",
            )
            if (added == null || added.files.isEmpty()) {
                runOnUiThread {
                    selectionSubtitle.text = "Не вдалося підготувати торрент"
                    selectionButtons.forEach { it.isEnabled = true }
                }
                return@launch
            }

            runOnUiThread {
                showFileSelection(item, torrent, added.hash, added.files)
            }
        }
    }

    private fun showFileSelection(
        item: FeaturedItem,
        torrent: TvApiClient.TorrentCandidate,
        torrentHash: String,
        files: List<TvApiClient.StreamFile>,
    ) {
        selectionTitle.text = item.title
        selectionSubtitle.text = "Оберіть файл"
        selectionList.removeAllViews()

        val rankedFiles = rankFiles(files, item.mediaType).take(16)
        selectionButtons = rankedFiles.map { file ->
            buildSelectionButton(
                title = file.name,
                subtitle = formatBytes(file.size)
            ) {
                startFeaturedPlayback(item, torrent, torrentHash, file)
            }
        }

        selectionButtons.forEach { selectionList.addView(it) }
        transitionTo(AppState.CONNECTED_SELECTION)
    }

    private fun rankFiles(
        files: List<TvApiClient.StreamFile>,
        mediaType: String,
    ): List<TvApiClient.StreamFile> {
        return files.sortedByDescending { file ->
            var score = 0L
            val name = file.name
            if (mediaType == "tv") {
                if (Regex("""S0?1E0?1""", RegexOption.IGNORE_CASE).containsMatchIn(name)) score += 1_000_000
                if (Regex("""1x01""", RegexOption.IGNORE_CASE).containsMatchIn(name)) score += 900_000
            }
            score + file.size
        }
    }

    private fun startFeaturedPlayback(
        item: FeaturedItem,
        torrent: TvApiClient.TorrentCandidate,
        torrentHash: String,
        file: TvApiClient.StreamFile,
    ) {
        selectionOverlay.visibility = View.GONE
        val normalizedUrl = normalizePlaybackUrl(file.streamUrl)
        currentTorrentHash = torrentHash
        currentTorrentFileId = file.fileId
        currentTorrentFname = file.name
        currentTorrentMagnet = torrent.magnet
        playUrl(
            url = normalizedUrl,
            link = null,
            originName = item.title,
            title = item.title,
            image = item.posterUrl ?: item.backdropUrl,
            movieId = "tmdb_${item.mediaType}_${item.tmdbId}",
            season = if (item.mediaType == "tv") 1 else null,
            episode = if (item.mediaType == "tv") 1 else null,
            userId = controllerUserId.ifBlank {
                TvSession.getProfileId(this@MainActivity).takeIf { it > 0 }?.toString()
            },
            startPositionMs = null,
        )
    }

    private fun normalizePlaybackUrl(rawUrl: String): String {
        return try {
            val parsed = URL(rawUrl)
            val base = URL(BuildConfig.BACKEND_BASE_URL)
            val query = parsed.query
                ?.split("&")
                ?.filter { it.isNotBlank() && !it.startsWith("transcode=") }
                ?.joinToString("&")
                ?: ""

            buildString {
                append(base.protocol)
                append("://")
                append(base.host)
                if (base.port != -1) append(":${base.port}")
                append(parsed.path)
                if (query.isNotBlank()) append("?$query")
            }
        } catch (_: Exception) {
            rawUrl
        }
    }

    private fun buildSelectionButton(
        title: String,
        subtitle: String,
        onClick: () -> Unit,
    ): Button {
        val btn = Button(this)
        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = (12 * resources.displayMetrics.density).toInt() }
        btn.layoutParams = lp
        btn.text = if (subtitle.isBlank()) title else "$title\n$subtitle"
        btn.isAllCaps = false
        btn.textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        btn.gravity = Gravity.START or Gravity.CENTER_VERTICAL
        btn.setPadding(28, 22, 28, 22)
        btn.textSize = 15f
        btn.setTextColor(Color.WHITE)
        btn.background = getDrawable(R.drawable.bg_btn_dark_focusable)
        btn.setOnClickListener { onClick() }
        return btn
    }

    private fun formatBytes(size: Long): String {
        if (size <= 0) return ""
        val gb = size.toDouble() / 1024.0 / 1024.0 / 1024.0
        return if (gb >= 1.0) "%.2f GB".format(gb) else "%.0f MB".format(size.toDouble() / 1024.0 / 1024.0)
    }

    private fun buildDots(count: Int, selected: Int) {
        slideDots.removeAllViews()
        val ctx = this
        for (i in 0 until count) {
            val dot = View(ctx)
            val size = if (i == selected) 10 else 7
            val px = (size * resources.displayMetrics.density).toInt()
            val lp = LinearLayout.LayoutParams(px, px).apply { setMargins(5, 0, 5, 0) }
            dot.layoutParams = lp
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(if (i == selected) Color.WHITE else Color.parseColor("#66FFFFFF"))
            }
            dot.background = bg
            slideDots.addView(dot)
        }
    }

    private val autoScrollRunnable = object : Runnable {
        override fun run() {
            if (appState != AppState.CONNECTED_IDLE) return
            val count = sliderItems.size
            if (count == 0) return
            val next = (featuredPager.currentItem + 1) % count
            featuredPager.setCurrentItem(next, true)
            sliderAutoHandler.postDelayed(this, 7000L)
        }
    }

    private fun startAutoScroll(count: Int) {
        if (count <= 1) return
        sliderAutoHandler.removeCallbacks(autoScrollRunnable)
        sliderAutoHandler.postDelayed(autoScrollRunnable, 7000L)
    }

    private fun resetAutoScroll(count: Int) {
        sliderAutoHandler.removeCallbacks(autoScrollRunnable)
        sliderAutoHandler.postDelayed(autoScrollRunnable, 7000L)
    }

    private fun stopAutoScroll() {
        sliderAutoHandler.removeCallbacks(autoScrollRunnable)
    }

    // ---------- Auth screen ----------

    private fun setupAuthScreen() {
        authBtnLogin.setOnClickListener {
            val email = authEmail.text.toString().trim()
            val pass  = authPassword.text.toString()
            if (email.isEmpty() || pass.isEmpty()) {
                showAuthError("Введіть email та пароль")
                return@setOnClickListener
            }
            authBtnLogin.isEnabled = false
            authError.visibility = View.GONE
            val deviceName = TvSession.getDeviceName(this)
            ioScope.launch {
                val result = TvApiClient.login(BuildConfig.BACKEND_BASE_URL, email, pass, deviceId, deviceName)
                runOnUiThread {
                    authBtnLogin.isEnabled = true
                    if (result == null) {
                        showAuthError("Невірний email або пароль")
                    } else {
                        pendingAuthToken  = result.authToken
                        pendingAccountId  = result.accountId
                        stopQrPolling()
                        showProfilePicker(result.profiles)
                    }
                }
            }
        }
    }

    private fun showAuthError(msg: String) {
        authError.text = msg
        authError.visibility = View.VISIBLE
    }

    /** Called each time AUTH state is entered — generates QR and starts polling */
    private fun startQrAuth() {
        authError.visibility = View.GONE
        authEmail.text?.clear()
        authPassword.text?.clear()
        authQrImage.setImageBitmap(null)
        authQrStatus.text = "Генеруємо QR…"

        val deviceName = TvSession.getDeviceName(this)
        stopQrPolling()
        qrPollJob = ioScope.launch {
            val qrData = TvApiClient.qrCreate(BuildConfig.BACKEND_BASE_URL, deviceId, deviceName)
            if (qrData == null) {
                runOnUiThread { authQrStatus.text = "Не вдалось створити QR" }
                return@launch
            }
            // Render QR bitmap
            val bmp = generateQr(qrData.qrUrl, 512)
            runOnUiThread {
                authQrImage.setImageBitmap(bmp)
                authQrStatus.text = "Відскануй та підтвердь на сайті"
            }
            // Poll until confirmed or expired
            val deadline = System.currentTimeMillis() + qrData.expiresIn * 1000L
            while (System.currentTimeMillis() < deadline) {
                delay(3000L)
                if (!isActive) return@launch
                val poll = TvApiClient.qrPoll(BuildConfig.BACKEND_BASE_URL, qrData.token)
                if (poll.confirmed && poll.authToken != null) {
                    runOnUiThread {
                        pendingAuthToken = poll.authToken
                        pendingAccountId = poll.accountId
                        showProfilePicker(poll.profiles)
                    }
                    return@launch
                }
                if (poll.expired) {
                    runOnUiThread { authQrStatus.text = "QR застарів. Натисніть ↺ або введіть дані вручну." }
                    return@launch
                }
            }
            runOnUiThread { authQrStatus.text = "QR застарів. Натисніть ↺ або введіть дані вручну." }
        }
    }

    private fun stopQrPolling() {
        qrPollJob?.cancel()
        qrPollJob = null
    }

    private fun showProfilePicker(profiles: List<TvApiClient.ProfileInfo>) {
        if (profiles.size == 1) {
            finishLogin(profiles[0])
            return
        }
        profilesRow.removeAllViews()
        for (profile in profiles) {
            val card = buildProfileCard(profile)
            profilesRow.addView(card)
        }
        transitionTo(AppState.PROFILE_PICKER)
    }

    private fun buildProfileCard(profile: TvApiClient.ProfileInfo): View {
        val dp = resources.displayMetrics.density
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val size = (140 * dp).toInt()
            val lp = LinearLayout.LayoutParams(size, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins((16 * dp).toInt(), 0, (16 * dp).toInt(), 0)
            layoutParams = lp
            isFocusable = true
            isClickable = true
            background = null
        }

        val avatar = ImageView(this).apply {
            val s = (96 * dp).toInt()
            layoutParams = LinearLayout.LayoutParams(s, s)
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        val avatarFullUrl = profile.avatarUrl?.let {
            if (it.startsWith("http")) it else "${BuildConfig.BACKEND_BASE_URL}$it"
        }
        Glide.with(this)
            .load(avatarFullUrl)
            .apply(RequestOptions().transform(CircleCrop()))
            .placeholder(android.R.drawable.ic_menu_myplaces)
            .into(avatar)

        val name = TextView(this).apply {
            text = profile.name
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            gravity = Gravity.CENTER
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = (10 * dp).toInt()
            layoutParams = lp
        }

        card.addView(avatar)
        card.addView(name)

        card.setOnClickListener { finishLogin(profile) }
        card.setOnFocusChangeListener { v, focused ->
            v.animate().scaleX(if (focused) 1.12f else 1f).scaleY(if (focused) 1.12f else 1f).setDuration(150).start()
        }
        return card
    }

    private fun finishLogin(profile: TvApiClient.ProfileInfo) {
        val token = pendingAuthToken
        val accountId = pendingAccountId
        val deviceName = TvSession.getDeviceName(this)

        TvSession.save(
            ctx          = this,
            authToken    = token,
            accountId    = accountId,
            profileId    = profile.id,
            profileName  = profile.name,
            profileAvatar = profile.avatarUrl,
            deviceName   = deviceName,
        )

        // Register device first, then connect WS so backend already treats this TV as logged in.
        ioScope.launch {
            val registered = TvApiClient.registerDevice(
                BuildConfig.BACKEND_BASE_URL, token, deviceId, profile.id, deviceName
            )
            if (registered) {
                runOnUiThread { ensureWsClientConnected() }
            }
        }

        // After login/profile change → go straight to slider
        initControllerFromSession()
        transitionTo(AppState.CONNECTED_IDLE)
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

    private fun ensureWsClientConnected() {
        if (!TvSession.isLoggedIn(this)) return
        if (wsClient == null) {
            startWsClient()
        }
    }

    // ---------- PlayerHubListener ----------

    override fun onControllerConnected(profileName: String) {
        onControllerConnectedWithAvatar(profileName, "")
    }

    override fun onControllerConnectedWithAvatar(profileName: String, avatarUrl: String, userId: String) {
        controllerProfileName = profileName
        controllerAvatarUrl   = avatarUrl
        controllerUserId      = userId
        runOnUiThread {
            // Cancel any pending disconnect transition
            disconnectHandler.removeCallbacks(disconnectRunnable)
            // Only react if the user is actually logged in and watching
            if (appState == AppState.AUTH || appState == AppState.PROFILE_PICKER || appState == AppState.SPLASH) return@runOnUiThread
            if (appState != AppState.PLAYING) {
                transitionTo(AppState.CONNECTED_IDLE)
            }
        }
    }

    override fun onControllerDisconnected() {
        // Controller disconnected — stay on current screen (slider or playing).
        // TV is always showing content; no "waiting" screen needed.
        runOnUiThread {
            disconnectHandler.removeCallbacks(disconnectRunnable)
        }
    }

    /** Плавний fade-перехід між екранами */
    private fun transitionTo(newState: AppState) {
        val fromState = appState
        val current = when (fromState) {
            AppState.SPLASH          -> splashContainer
            AppState.AUTH            -> screenAuth
            AppState.PROFILE_PICKER  -> screenProfilePicker
            AppState.DISCONNECTED    -> screenDisconnected
            AppState.CONNECTED_IDLE  -> screenConnected
            AppState.CONNECTED_DETAILS -> screenConnected
            AppState.CONNECTED_SELECTION -> screenConnected
            AppState.PLAYING         -> null
        }

        current?.animate()?.alpha(0f)?.setDuration(250)?.withEndAction {
            current.alpha = 1f
            // If state already changed during the animation (e.g. playUrl was called),
            // don't overwrite it — abort this transition.
            if (appState != fromState) return@withEndAction
            setState(newState)
            val next = when (newState) {
                AppState.AUTH            -> screenAuth
                AppState.PROFILE_PICKER  -> screenProfilePicker
                AppState.DISCONNECTED    -> screenDisconnected
                AppState.CONNECTED_IDLE  -> screenConnected
                AppState.CONNECTED_DETAILS -> screenConnected
                AppState.CONNECTED_SELECTION -> screenConnected
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
            currentTorrentHash = null
            currentTorrentFileId = null
            currentTorrentFname = null
            currentTorrentMagnet = null

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
            return buildStatusOnMain().also { lastKnownStatus = it }
        }

        var result: PlayerStatus? = null
        val latch = CountDownLatch(1)

        runOnUiThread {
            try {
                result = buildStatusOnMain().also { lastKnownStatus = it }
            } finally {
                latch.countDown()
            }
        }

        latch.await(300, TimeUnit.MILLISECONDS)

        // Use cached status as fallback to avoid reporting position=0 on timeout
        return result ?: lastKnownStatus ?: PlayerStatus(
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
            userId = currentUserId,
            torrentHash = currentTorrentHash,
            torrentFileId = currentTorrentFileId,
            torrentFname = currentTorrentFname,
            torrentMagnet = currentTorrentMagnet
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
            userId = currentUserId,
            torrentHash = currentTorrentHash,
            torrentFileId = currentTorrentFileId,
            torrentFname = currentTorrentFname,
            torrentMagnet = currentTorrentMagnet
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

        stopAutoScroll()
        sliderJob?.cancel()
        stopQrPolling()
        disconnectHandler.removeCallbacks(disconnectRunnable)

        currentLink = null
        currentOriginName = null
        currentTitle = null
        currentImage = null
        currentMovieId = null
        currentSeason = null
        currentEpisode = null
        currentUserId = null
        currentTorrentHash = null
        currentTorrentFileId = null
        currentTorrentFname = null
        currentTorrentMagnet = null
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
        currentTorrentHash = null; currentTorrentFileId = null
        currentTorrentFname = null; currentTorrentMagnet = null
    }

    // ---------- Movie selected on TV → notify controllers ----------

    private fun sendMovieSelectedToControllers(item: FeaturedItem) {
        val movieId = "tmdb_${item.mediaType}_${item.tmdbId}"
        val msg = org.json.JSONObject()
            .put("jsonrpc", "2.0")
            .put("method", "PlayerHub.MovieSelected")
            .put("params", org.json.JSONObject()
                .put("movie_id", movieId)
                .put("tmdb_id", item.tmdbId)
                .put("media_type", item.mediaType)
                .put("title", item.title)
            )
            .toString()
        wsClient?.sendRaw(msg)
        Log.d(TAG, "MovieSelected sent: $movieId")
    }

    // ---------- Пульт / клавіші ----------

    private fun seekBy(deltaMs: Long) {
        val p = player ?: return
        val duration = if (p.duration > 0) p.duration else Long.MAX_VALUE
        val maxPos = if (duration < Long.MAX_VALUE) (duration - 1000L).coerceAtLeast(0L) else Long.MAX_VALUE
        val newPos = (p.currentPosition + deltaMs)
            .coerceAtLeast(0L)
            .coerceAtMost(maxPos)

        p.seekTo(newPos)
        val st = getStatus()
        wsClient?.sendNotification("Player.OnSeek", st)
        ProgressReporter.reportImmediate(st)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {

                // Back під час перегляду — зупиняємо; якщо плашка відкрита — закриваємо
                KeyEvent.KEYCODE_BACK -> {
                    if (appState == AppState.PLAYING) {
                        stopPlayback()
                        return true
                    }
                    if (appState == AppState.CONNECTED_DETAILS) {
                        closeMovieDetails()
                        return true
                    }
                    if (appState == AppState.CONNECTED_SELECTION) {
                        openMovieDetails(selectedFeaturedItem ?: return true)
                        return true
                    }
                    if (appState == AppState.CONNECTED_IDLE && pillExpanded) {
                        collapsePill()
                        return true
                    }
                    // в інших станах — стандартна поведінка (мінімізує апку)
                }

                // D-pad Up → focus pill and expand
                // D-pad Up → just focus the pill (don't expand yet)
                KeyEvent.KEYCODE_DPAD_UP -> {
                    if (appState == AppState.CONNECTED_IDLE && !isPillHierarchyFocused()) {
                        profilePill.requestFocus()
                        return true
                    }
                }

                // D-pad Down from pill → collapse and return focus
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    if (appState == AppState.CONNECTED_IDLE && isPillHierarchyFocused()) {
                        collapsePill()
                        featuredPager.requestFocus()
                        return true
                    }
                }

                // Play/Pause
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                    if (appState == AppState.PLAYING) {
                        togglePlayPause()
                        return true
                    }
                }

                // CENTER / ENTER
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> {
                    if (appState == AppState.PLAYING) {
                        togglePlayPause()
                        return true
                    }
                    if (appState == AppState.CONNECTED_IDLE) {
                        val focused = currentFocus
                        when {
                            // Pill focused, not expanded → expand + focus first button
                            focused == profilePill && !pillExpanded -> {
                                expandPill()
                                profilePill.post {
                                    profilePill.findViewById<Button>(R.id.pill_btn_switch).requestFocus()
                                }
                            }
                            // Button focused → perform its click directly
                            focused is Button && isPillHierarchyFocused() ->
                                focused.performClick()
                            // Anywhere else → consume silently
                            else -> {
                                sliderItems.getOrNull(featuredPager.currentItem)?.let { openMovieDetails(it) }
                            }
                        }
                        return true
                    }
                    if (appState == AppState.CONNECTED_DETAILS) {
                        if (currentFocus === movieDetailsWatchButton) {
                            movieDetailsWatchButton.performClick()
                        }
                        return true
                    }
                    if (appState == AppState.CONNECTED_SELECTION) {
                        (currentFocus as? Button)?.performClick()
                        return true
                    }
                }

                // LEFT/RIGHT — navigate buttons when pill open, slide otherwise
                KeyEvent.KEYCODE_DPAD_RIGHT,
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                    if (appState == AppState.PLAYING) { seekBy(15_000L); return true }
                    if (appState == AppState.CONNECTED_IDLE) {
                        if (isPillHierarchyFocused() && pillExpanded) {
                            navigatePillButtons(forward = true); return true
                        }
                        if (sliderItems.isNotEmpty()) {
                            val next = (featuredPager.currentItem + 1) % sliderItems.size
                            featuredPager.setCurrentItem(next, true)
                            return true
                        }
                    }
                }

                KeyEvent.KEYCODE_DPAD_LEFT,
                KeyEvent.KEYCODE_MEDIA_REWIND -> {
                    if (appState == AppState.PLAYING) { seekBy(-15_000L); return true }
                    if (appState == AppState.CONNECTED_IDLE) {
                        if (isPillHierarchyFocused() && pillExpanded) {
                            navigatePillButtons(forward = false); return true
                        }
                        if (sliderItems.isNotEmpty()) {
                            val prev = (featuredPager.currentItem - 1 + sliderItems.size) % sliderItems.size
                            featuredPager.setCurrentItem(prev, true)
                            return true
                        }
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
