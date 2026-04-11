# Nestify TV

TV-optimized frontend for Nestify, deployed at `tv.opencine.cloud`.

Built with React + Vite. Designed to be loaded in an Android WebView with D-pad navigation.

## Key differences from `frontend-vite`

- Always in **tv-mode**: cursor hidden, white focus-visible ring on all focusable elements
- No `MobileBottomNav`, `MiniPlayer`, `PickerPage`, `TikTokPickerPage`, `ConnectPlayerPage`, `AdminPage`
- `AndroidBridge.js` — JS interface to native ExoPlayer (play, pause, seek, volume, back)
- Dev server runs on port **5174** (no conflict with main site on 5173)

## Dev

```bash
cp .env.example .env   # set VITE_BACKEND_URL, VITE_TMDB_KEY
npm install
npm run dev            # http://localhost:5174
```

## Build & deploy

```bash
npm run build
# dist/ → nginx serves tv.opencine.cloud
```

Or via Docker:

```bash
docker build --build-arg VITE_BACKEND_URL=https://api.opencine.cloud -t nestify-tv .
docker run -p 80:80 nestify-tv
```

## AndroidBridge API

When loaded in the Android WebView, `window.AndroidBridge` must expose:

| Method | Description |
|--------|-------------|
| `play(url, title, posterUrl, mediaType, tmdbId, positionMs)` | Start ExoPlayer |
| `pause()` | Pause playback |
| `resume()` | Resume playback |
| `seekTo(positionMs)` | Seek |
| `setVolume(level)` | 0.0 – 1.0 |
| `goBack()` | Native back navigation |
| `openSearch()` | Focus search input |
| `notifyPageReady()` | Called by React on startup |
