package com.nestify.tvshell;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.net.URL;

public class MainActivity extends AppCompatActivity implements PlayerWsClient.Listener {
    private static final String BRIDGE_NAME = "AndroidBridge";
    private static final long PRECISE_SEEK_MS = 5_000L;

    private WebView webView;
    private PlayerView playerView;
    private ExoPlayer player;
    private PlayerWsClient playerWsClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private String deviceId;
    private boolean webAppReady = false;

    private String currentLink = "";
    private String currentOriginName = "";
    private String currentTitle = "";
    private String currentImage = "";
    private String currentMovieId = "";
    private Integer currentSeason = null;
    private Integer currentEpisode = null;
    private String currentUserId = "";
    private String currentTorrentHash = "";
    private Integer currentTorrentFileId = null;
    private String currentTorrentFname = "";
    private String currentTorrentMagnet = "";

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (player != null && isPlayerVisible() && player.isPlaying()) {
                sendPlayerNotification("Player.OnProgress");
                progressHandler.postDelayed(this, 5000L);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        deviceId = DeviceId.get(this);
        webView = findViewById(R.id.web_view);
        playerView = findViewById(R.id.player_view);

        setupPlayer();
        setupWebView();
        setupBackHandler();
        restoreNativeSession();
        webView.loadUrl(BuildConfig.START_URL);
    }

    private void restoreNativeSession() {
        if (!TvSession.hasAccountSession(this)) {
            return;
        }

        if (TvSession.hasSelectedProfile(this)) {
            ensurePlayerWsConnected();
        }

        new Thread(() -> {
            String token = TvSession.getAuthToken(MainActivity.this);
            if (token == null || TvApiClient.validateToken(BuildConfig.BACKEND_BASE_URL, token)) {
                return;
            }

            runOnUiThread(() -> {
                disconnectPlayerWs();
                TvSession.clear(MainActivity.this);
                if (webAppReady && webView != null) {
                    webView.loadUrl(BuildConfig.START_URL);
                }
            });
        }).start();
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " NestifyTvShell/1.0");

        webView.setBackgroundColor(0xFF000000);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return super.onConsoleMessage(consoleMessage);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), BRIDGE_NAME);
    }

    private void setupPlayer() {
        player = new ExoPlayer.Builder(this)
            .setSeekBackIncrementMs(10_000L)
            .setSeekForwardIncrementMs(10_000L)
            .build();
        playerView.setPlayer(player);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(false);
        playerView.setKeepScreenOn(true);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                ProgressReporter.reportImmediate(getStatus());
                ProgressReporter.stop();
                sendPlayerNotification("Player.OnStop");
                closePlayer(false);
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    ProgressReporter.reportImmediate(getStatus());
                    ProgressReporter.stop();
                    sendPlayerNotification("Player.OnEnd");
                    closePlayer(false);
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (!isPlayerVisible()) {
                    return;
                }
                sendPlayerNotification(isPlaying ? "Player.OnPlay" : "Player.OnPause");
                ProgressReporter.reportImmediate(getStatus());
                progressHandler.removeCallbacks(progressRunnable);
                if (isPlaying) {
                    ProgressReporter.start(MainActivity.this::getStatus);
                    progressHandler.postDelayed(progressRunnable, 5000L);
                } else {
                    ProgressReporter.stop();
                }
            }

            @Override
            public void onPositionDiscontinuity(
                @NonNull Player.PositionInfo oldPosition,
                @NonNull Player.PositionInfo newPosition,
                int reason
            ) {
                if (isPlayerVisible()) {
                    ProgressReporter.reportImmediate(getStatus());
                    sendPlayerNotification("Player.OnSeek");
                }
            }

            @Override
            public void onVolumeChanged(float volume) {
                if (isPlayerVisible()) {
                    sendPlayerNotification("Application.OnVolume");
                }
            }
        });
    }

    private void setupBackHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isPlayerVisible()) {
                    closePlayer(true);
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                moveTaskToBack(true);
            }
        });
    }

    private boolean isPlayerVisible() {
        return playerView.getVisibility() == View.VISIBLE;
    }

    private void playUrl(
        String url,
        String link,
        String originName,
        String title,
        String image,
        String movieId,
        Integer season,
        Integer episode,
        String userId,
        long positionMs,
        String torrentHash,
        Integer torrentFileId,
        String torrentFname,
        String torrentMagnet
    ) {
        String normalizedUrl = normalizePlaybackUrl(url);
        if (normalizedUrl == null || normalizedUrl.isBlank()) {
            return;
        }

        currentLink = link != null ? link : "";
        currentOriginName = originName != null ? originName : "";
        currentTitle = title != null ? title : "";
        currentImage = image != null ? image : "";
        currentMovieId = movieId != null ? movieId : "";
        currentSeason = season;
        currentEpisode = episode;
        currentUserId = userId != null ? userId : "";
        currentTorrentHash = torrentHash != null ? torrentHash : "";
        currentTorrentFileId = torrentFileId;
        currentTorrentFname = torrentFname != null ? torrentFname : "";
        currentTorrentMagnet = torrentMagnet != null ? torrentMagnet : "";

        MediaItem mediaItem = new MediaItem.Builder().setUri(Uri.parse(normalizedUrl)).build();
        player.setMediaItem(mediaItem);
        player.prepare();
        if (positionMs > 0) {
            player.seekTo(positionMs);
            ProgressReporter.syncPosition(positionMs);
        }
        playerView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        player.play();
        playerView.requestFocus();
    }

    private String normalizePlaybackUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return rawUrl;
        }

        try {
            URL parsed = new URL(rawUrl);
            URL base = new URL(BuildConfig.BACKEND_BASE_URL);
            String query = parsed.getQuery();
            StringBuilder filteredQuery = new StringBuilder();

            if (query != null && !query.isBlank()) {
                for (String part : query.split("&")) {
                    if (part == null || part.isBlank() || part.startsWith("transcode=")) {
                        continue;
                    }
                    if (filteredQuery.length() > 0) {
                        filteredQuery.append("&");
                    }
                    filteredQuery.append(part);
                }
            }

            StringBuilder normalized = new StringBuilder();
            normalized.append(base.getProtocol()).append("://").append(base.getHost());
            if (base.getPort() != -1) {
                normalized.append(":").append(base.getPort());
            }
            normalized.append(parsed.getPath());
            if (filteredQuery.length() > 0) {
                normalized.append("?").append(filteredQuery);
            }
            return normalized.toString();
        } catch (Exception ignored) {
            return rawUrl;
        }
    }

    private void closePlayer(boolean notifyStop) {
        if (!isPlayerVisible()) {
            return;
        }
        progressHandler.removeCallbacks(progressRunnable);
        if (notifyStop) {
            ProgressReporter.reportImmediate(getStatus());
            ProgressReporter.stop();
            sendPlayerNotification("Player.OnStop");
        }
        player.pause();
        player.stop();
        player.clearMediaItems();
        clearCurrentMedia();
        playerView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.requestFocus();
    }

    private void clearCurrentMedia() {
        currentLink = "";
        currentOriginName = "";
        currentTitle = "";
        currentImage = "";
        currentMovieId = "";
        currentSeason = null;
        currentEpisode = null;
        currentUserId = "";
        currentTorrentHash = "";
        currentTorrentFileId = null;
        currentTorrentFname = "";
        currentTorrentMagnet = "";
    }

    private void pausePlayer() {
        if (player != null) {
            player.pause();
        }
    }

    private void resumePlayer() {
        if (player != null && isPlayerVisible()) {
            player.play();
        }
    }

    private void seekToPosition(long positionMs) {
        if (player != null) {
            player.seekTo(Math.max(positionMs, 0L));
        }
    }

    private void setPlayerVolumePercent(int volumePercent) {
        if (player != null) {
            float normalized = Math.max(0f, Math.min(volumePercent / 100f, 1f));
            player.setVolume(normalized);
        }
    }

    private void openSearch() {
        webView.evaluateJavascript("window.location.assign('/search')", null);
    }

    private void ensurePlayerWsConnected() {
        if (!TvSession.hasSelectedProfile(this)) {
            return;
        }
        if (playerWsClient == null) {
            playerWsClient = new PlayerWsClient(BuildConfig.WS_BASE_URL, deviceId, this);
        }
        playerWsClient.connect();
    }

    private void disconnectPlayerWs() {
        if (playerWsClient != null) {
            playerWsClient.close();
            playerWsClient = null;
        }
    }

    private void sendPlayerNotification(String method) {
        if (playerWsClient != null) {
            playerWsClient.sendNotification(method, getStatus());
        }
    }

    private String jsonSuccess(JSONObject data) {
        try {
            JSONObject obj = new JSONObject().put("ok", true);
            if (data != null) {
                obj.put("data", data);
            }
            return obj.toString();
        } catch (Exception e) {
            return "{\"ok\":true}";
        }
    }

    private String jsonError(String message) {
        try {
            return new JSONObject()
                .put("ok", false)
                .put("error", message)
                .toString();
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + message + "\"}";
        }
    }

    private String handleLogin(String email, String password) {
        try {
            JSONObject result = TvApiClient.login(
                BuildConfig.BACKEND_BASE_URL,
                email,
                password,
                deviceId,
                TvSession.getDeviceName(this)
            );

            JSONObject account = result.getJSONObject("account");
            JSONArray profiles = result.optJSONArray("profiles");
            if (profiles == null) {
                profiles = new JSONArray();
            }

            TvSession.saveAccountSession(
                this,
                result.getString("auth_token"),
                account.getInt("id"),
                account.optString("email", ""),
                account.optString("display_name", ""),
                profiles
            );

            JSONObject payload = new JSONObject();
            payload.put("auth_token", result.getString("auth_token"));
            payload.put("account", account);
            payload.put("profiles", profiles);
            payload.put("device_id", deviceId);
            payload.put("device_name", TvSession.getDeviceName(this));
            return jsonSuccess(payload);
        } catch (Exception e) {
            return jsonError(e.getMessage() != null ? e.getMessage() : "Login failed");
        }
    }

    private String handleCreateQrLogin() {
        try {
            JSONObject result = TvApiClient.qrCreate(
                BuildConfig.BACKEND_BASE_URL,
                deviceId,
                TvSession.getDeviceName(this)
            );
            result.put("qr_image_data_url", generateQrDataUrl(result.getString("qr_url"), 512));
            return jsonSuccess(result);
        } catch (Exception e) {
            return jsonError(e.getMessage() != null ? e.getMessage() : "QR create failed");
        }
    }

    private String handlePollQrLogin(String token) {
        try {
            JSONObject result = TvApiClient.qrPoll(BuildConfig.BACKEND_BASE_URL, token);
            if (result.optBoolean("confirmed", false)) {
                JSONObject account = result.getJSONObject("account");
                JSONArray profiles = result.optJSONArray("profiles");
                if (profiles == null) {
                    profiles = new JSONArray();
                }
                TvSession.saveAccountSession(
                    this,
                    result.getString("auth_token"),
                    account.getInt("id"),
                    account.optString("email", ""),
                    account.optString("display_name", ""),
                    profiles
                );
            }
            return jsonSuccess(result);
        } catch (Exception e) {
            return jsonError(e.getMessage() != null ? e.getMessage() : "QR poll failed");
        }
    }

    private String handleActivateProfile(int profileId, String profileName, String profileAvatar) {
        String token = TvSession.getAuthToken(this);
        if (token == null) {
            return jsonError("No TV account session");
        }
        try {
            TvApiClient.registerDevice(
                BuildConfig.BACKEND_BASE_URL,
                token,
                deviceId,
                profileId,
                TvSession.getDeviceName(this)
            );
            TvSession.activateProfile(this, profileId, profileName, profileAvatar);
            disconnectPlayerWs();
            ensurePlayerWsConnected();
            return jsonSuccess(TvSession.buildBootstrapPayload(this, deviceId));
        } catch (Exception e) {
            return jsonError(e.getMessage() != null ? e.getMessage() : "Profile activation failed");
        }
    }

    private String handleLogout() {
        String token = TvSession.getAuthToken(this);
        disconnectPlayerWs();
        closePlayer(false);
        if (token != null) {
            try {
                TvApiClient.logoutDevice(BuildConfig.BACKEND_BASE_URL, token, deviceId);
            } catch (Exception ignored) {
            }
        }
        TvSession.clear(this);
        return jsonSuccess(null);
    }

    private String generateQrDataUrl(String text, int size) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        var matrix = writer.encode(text, BarcodeFormat.QR_CODE, size, size);
        for (int x = 0; x < size; x++) {
            for (int y = 0; y < size; y++) {
                bmp.setPixel(x, y, matrix.get(x, y) ? Color.WHITE : Color.BLACK);
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
        String encoded = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        return "data:image/png;base64," + encoded;
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) {
            player.pause();
        }
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        progressHandler.removeCallbacks(progressRunnable);
        disconnectPlayerWs();
        if (player != null) {
            player.release();
            player = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface(BRIDGE_NAME);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }

        if (isPlayerVisible()) {
            if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                closePlayer(true);
                return true;
            }
            if (event.getKeyCode() == KeyEvent.KEYCODE_DPAD_LEFT) {
                seekToPosition(Math.max((player != null ? player.getCurrentPosition() : 0L) - PRECISE_SEEK_MS, 0L));
                return true;
            }
            if (event.getKeyCode() == KeyEvent.KEYCODE_DPAD_RIGHT) {
                long currentPosition = player != null ? player.getCurrentPosition() : 0L;
                long duration = player != null ? Math.max(player.getDuration(), 0L) : 0L;
                long nextPosition = currentPosition + PRECISE_SEEK_MS;
                if (duration > 0L) {
                    nextPosition = Math.min(nextPosition, duration);
                }
                seekToPosition(nextPosition);
                return true;
            }
            if (event.getKeyCode() == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                || event.getKeyCode() == KeyEvent.KEYCODE_DPAD_CENTER) {
                if (player.isPlaying()) {
                    player.pause();
                } else {
                    player.play();
                }
            }
        }

        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onPlayUrl(JSONObject params) {
        mainHandler.post(() -> {
            String url = params.optString("url", "");
            String link = params.optString("link", "");
            String originName = params.optString("origin_name", "");
            String title = params.optString("title", "");
            String image = params.optString("image", "");
            String movieId = params.optString("movie_id", "");
            Integer season = params.has("season") && !params.isNull("season") ? params.optInt("season") : null;
            Integer episode = params.has("episode") && !params.isNull("episode") ? params.optInt("episode") : null;
            String userId = params.optString("user_id", "");
            long positionMs = params.optLong("position_ms", 0L);
            String torrentHash = params.optString("torrent_hash", "");
            Integer torrentFileId = params.has("torrent_file_id") && !params.isNull("torrent_file_id")
                ? params.optInt("torrent_file_id")
                : null;
            String torrentFname = params.optString("torrent_fname", "");
            String torrentMagnet = params.optString("torrent_magnet", "");
            playUrl(url, link, originName, title, image, movieId, season, episode, userId, positionMs, torrentHash, torrentFileId, torrentFname, torrentMagnet);
        });
    }

    @Override
    public void onPlayPause() {
        mainHandler.post(() -> {
            if (player != null) {
                if (player.isPlaying()) {
                    player.pause();
                } else {
                    player.play();
                }
            }
        });
    }

    @Override
    public void onStop() {
        mainHandler.post(() -> closePlayer(true));
    }

    @Override
    public void onSeek(long positionMs) {
        mainHandler.post(() -> seekToPosition(positionMs));
    }

    @Override
    public void onSetVolume(int volume) {
        mainHandler.post(() -> setPlayerVolumePercent(volume));
    }

    @Override
    public JSONObject getStatus() {
        JSONObject obj = new JSONObject();
        try {
            obj.put("position_ms", player != null ? player.getCurrentPosition() : 0);
            obj.put("duration_ms", player != null ? Math.max(player.getDuration(), 0) : 0);
            obj.put("is_playing", player != null && player.isPlaying());
            obj.put("volume", player != null ? Math.round(player.getVolume() * 100f) : 100);
            obj.put("link", currentLink);
            obj.put("origin_name", currentOriginName);
            obj.put("title", currentTitle);
            obj.put("image", currentImage);
            obj.put("movie_id", currentMovieId);
            if (currentSeason != null) {
                obj.put("season", currentSeason);
            }
            if (currentEpisode != null) {
                obj.put("episode", currentEpisode);
            }
            obj.put("user_id", currentUserId);
            obj.put("torrent_hash", currentTorrentHash);
            if (currentTorrentFileId != null) {
                obj.put("torrent_file_id", currentTorrentFileId);
            }
            obj.put("torrent_fname", currentTorrentFname);
            obj.put("torrent_magnet", currentTorrentMagnet);
        } catch (Exception ignored) {
        }
        return obj;
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public boolean isNativeTvShell() {
            return true;
        }

        @JavascriptInterface
        public String getBootstrapState() {
            return TvSession.buildBootstrapPayload(MainActivity.this, deviceId).toString();
        }

        @JavascriptInterface
        public String loginAccount(String email, String password) {
            return handleLogin(email, password);
        }

        @JavascriptInterface
        public String createQrLogin() {
            return handleCreateQrLogin();
        }

        @JavascriptInterface
        public String pollQrLogin(String token) {
            return handlePollQrLogin(token);
        }

        @JavascriptInterface
        public String activateProfile(int profileId, String profileName, String profileAvatar) {
            return handleActivateProfile(profileId, profileName, profileAvatar);
        }

        @JavascriptInterface
        public String logoutAccount() {
            return handleLogout();
        }

        @JavascriptInterface
        public void play(String url, String title, String posterUrl, String mediaType, String tmdbId, long positionMs) {
            mainHandler.post(() -> playUrl(url, "", "", title, posterUrl, tmdbId, null, null, "", positionMs, "", null, "", ""));
        }

        @JavascriptInterface
        public void playPayload(String payloadJson) {
            try {
                JSONObject payload = new JSONObject(payloadJson);
                String url = payload.optString("url", "");
                String title = payload.optString("title", "");
                String posterUrl = payload.optString("posterUrl", "");
                String movieId = payload.optString("tmdbId", payload.optString("movieId", ""));
                String link = payload.optString("link", "");
                String originName = payload.optString("originName", "");
                String userId = payload.optString("userId", "");
                Integer season = payload.has("season") && !payload.isNull("season") ? payload.optInt("season") : null;
                Integer episode = payload.has("episode") && !payload.isNull("episode") ? payload.optInt("episode") : null;
                long positionMs = payload.optLong("positionMs", 0L);
                String torrentHash = payload.optString("torrentHash", "");
                Integer torrentFileId = payload.has("torrentFileId") && !payload.isNull("torrentFileId") ? payload.optInt("torrentFileId") : null;
                String torrentFname = payload.optString("torrentFname", "");
                String torrentMagnet = payload.optString("torrentMagnet", "");

                mainHandler.post(() -> playUrl(
                    url, link, originName, title, posterUrl, movieId, season, episode, userId, positionMs,
                    torrentHash, torrentFileId, torrentFname, torrentMagnet
                ));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void pause() {
            mainHandler.post(MainActivity.this::pausePlayer);
        }

        @JavascriptInterface
        public void resume() {
            mainHandler.post(MainActivity.this::resumePlayer);
        }

        @JavascriptInterface
        public void seekTo(long positionMs) {
            mainHandler.post(() -> seekToPosition(positionMs));
        }

        @JavascriptInterface
        public void setVolume(float level) {
            mainHandler.post(() -> {
                int percent = Math.round(Math.max(0f, Math.min(level, 1f)) * 100f);
                setPlayerVolumePercent(percent);
            });
        }

        @JavascriptInterface
        public void goBack() {
            mainHandler.post(() -> {
                if (isPlayerVisible()) {
                    closePlayer(true);
                } else if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            });
        }

        @JavascriptInterface
        public void openSearch() {
            mainHandler.post(MainActivity.this::openSearch);
        }

        @JavascriptInterface
        public void notifyPageReady() {
            webAppReady = true;
        }

        @JavascriptInterface
        public boolean isReady() {
            return webAppReady;
        }
    }
}
