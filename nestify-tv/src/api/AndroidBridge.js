/**
 * AndroidBridge — JS interface to the native Android WebView bridge.
 *
 * The Android app exposes `window.AndroidBridge` when the WebView is loaded.
 * All methods are no-ops when running outside of the WebView (browser dev mode).
 *
 * Android side must implement:
 *   @JavascriptInterface play(url, title, posterUrl, mediaType, tmdbId, positionMs)
 *   @JavascriptInterface pause()
 *   @JavascriptInterface resume()
 *   @JavascriptInterface seekTo(positionMs)
 *   @JavascriptInterface setVolume(level)   // 0.0 – 1.0
 *   @JavascriptInterface goBack()
 *   @JavascriptInterface openSearch()
 *   @JavascriptInterface notifyPageReady()  // called by React on mount
 */

function bridge() {
  return window.AndroidBridge || null;
}

export const isAndroidBridge = () => Boolean(bridge());

function parseBridgeJson(raw, fallbackError = "Android bridge error") {
  if (!raw) {
    throw new Error(fallbackError);
  }

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (parsed?.ok === false) {
    throw new Error(parsed.error || fallbackError);
  }
  return parsed?.data ?? parsed;
}

/**
 * Start playback in ExoPlayer.
 * @param {object} opts
 * @param {string} opts.url         HLS/stream URL
 * @param {string} opts.title       Human-readable title
 * @param {string} [opts.posterUrl] Poster/backdrop image URL
 * @param {string} [opts.mediaType] "movie" | "tv"
 * @param {string} [opts.tmdbId]    TMDB ID (for progress tracking)
 * @param {number} [opts.positionMs] Resume position in milliseconds
 */
export function androidPlay({
  url,
  title,
  posterUrl = "",
  mediaType = "movie",
  tmdbId = "",
  movieId = "",
  positionMs = 0,
  userId = "",
  season = null,
  episode = null,
}) {
  const b = bridge();
  if (b?.playPayload) {
    b.playPayload(
      JSON.stringify({
        url,
        title,
        posterUrl,
        mediaType,
        tmdbId: String(tmdbId),
        movieId: String(movieId || tmdbId || ""),
        positionMs,
        userId: userId ? String(userId) : "",
        season,
        episode,
      })
    );
  } else if (b?.play) {
    b.play(url, title, posterUrl, mediaType, String(tmdbId), positionMs);
  } else {
    // Dev fallback: navigate to internal player
    console.info("[AndroidBridge] play() called without bridge:", { url, title });
  }
}

export function androidPause() {
  bridge()?.pause?.();
}

export function androidResume() {
  bridge()?.resume?.();
}

export function androidSeekTo(positionMs) {
  bridge()?.seekTo?.(positionMs);
}

export function androidSetVolume(level) {
  bridge()?.setVolume?.(level);
}

export function androidGoBack() {
  bridge()?.goBack?.();
}

export function androidOpenSearch() {
  bridge()?.openSearch?.();
}

/** Called once on React app mount so the native side knows the WebView is ready. */
export function androidNotifyReady() {
  bridge()?.notifyPageReady?.();
}

export function getAndroidBootstrapState() {
  const b = bridge();
  if (!b?.getBootstrapState) return null;
  return parseBridgeJson(b.getBootstrapState(), "Failed to load TV session");
}

export function androidLoginAccount(email, password) {
  const b = bridge();
  if (!b?.loginAccount) {
    throw new Error("Android TV login bridge is unavailable");
  }
  return parseBridgeJson(
    b.loginAccount(String(email || ""), String(password || "")),
    "TV login failed"
  );
}

export function androidCreateQrLogin() {
  const b = bridge();
  if (!b?.createQrLogin) {
    throw new Error("Android TV QR bridge is unavailable");
  }
  return parseBridgeJson(b.createQrLogin(), "Failed to create QR login");
}

export function androidPollQrLogin(token) {
  const b = bridge();
  if (!b?.pollQrLogin) {
    throw new Error("Android TV QR bridge is unavailable");
  }
  return parseBridgeJson(
    b.pollQrLogin(String(token || "")),
    "Failed to poll QR login"
  );
}

export function androidActivateProfile(profile) {
  const b = bridge();
  if (!b?.activateProfile) {
    throw new Error("Android TV profile bridge is unavailable");
  }
  return parseBridgeJson(
    b.activateProfile(
      Number(profile?.id || 0),
      String(profile?.name || ""),
      String(profile?.avatar_url || "")
    ),
    "Failed to activate TV profile"
  );
}

export function androidLogoutAccount() {
  const b = bridge();
  if (!b?.logoutAccount) {
    return { ok: true };
  }
  return parseBridgeJson(b.logoutAccount(), "Failed to logout TV account");
}

export function playWithAndroidBridgeOrFallback({
  url,
  title,
  posterUrl = "",
  mediaType = "movie",
  tmdbId = "",
  movieId = "",
  positionMs = 0,
  link = "",
  originName = "",
  userId = "",
  season = null,
  episode = null,
  torrentHash = "",
  torrentFileId = null,
  torrentFname = "",
  torrentMagnet = "",
  fallback,
}) {
  const b = bridge();
  if (isAndroidBridge() && url) {
    if (b?.playPayload) {
      b.playPayload(
        JSON.stringify({
          url,
          title,
          posterUrl,
          mediaType,
          tmdbId: String(tmdbId),
          movieId: String(movieId || tmdbId || ""),
          positionMs,
          link,
          originName,
          userId: userId ? String(userId) : "",
          season,
          episode,
          torrentHash,
          torrentFileId,
          torrentFname,
          torrentMagnet,
        })
      );
    } else {
      androidPlay({ url, title, posterUrl, mediaType, tmdbId, movieId, positionMs, userId, season, episode });
    }
    return true;
  }

  if (typeof fallback === "function") {
    fallback();
  }

  return false;
}
