# Nestify Web

The main Nestify site: React 19, Vite 5 and React Router 7. Metadata and images come from TMDB,
everything else from the [backend](../backend/README.md).

## Run

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

| Variable | Meaning |
|---|---|
| `VITE_BACKEND_URL` | Backend address, local or production |
| `VITE_TMDB_KEY` | TMDB API key |
| `VITE_TMDB_BASE`, `VITE_TMDB_IMG` | TMDB API and image hosts |
| `VITE_HDREZKA_URL` | HDRezka mirror for links to the site |

Vite inlines these at build time, so the Docker image takes them as build arguments.

## Layout

```text
src/
  api/          Backend and TMDB calls. plugins.js covers sources, playback and extensions
  core/         Logic without React: which source to play, grouping, torrent search
  hooks/        Data hooks: sources, live session, TV device
  pages/        One file per route
  components/   Shared UI, the player icons live in components/ui/PlayerIcons.jsx
  styles/       One stylesheet per page or component
```

### Playback

`core/playbackPlan.js` decides what Play starts: the voice-over remembered for the series, then
the best quality. It asks only the fast plugins (`direct`, `hls`), so the film starts in a few
seconds. The source picker asks the slow ones (torrents) separately. Both are tested with
`node --test`:

```bash
node --test src/core/*.test.js
```

### Large screens

`styles/LargeScreens.css` scales the page with `zoom` from 1800 px wide, so the site looks the same
on a 2K or 4K monitor. The bottom navigation and the mini player stay at their own size. Rules that
use `vh` inside the zoomed area must divide by `--screen-zoom`.

### Rows

`core/dragScroll.js` lets the mouse drag every horizontal row. Swiper sliders, the player and form
fields keep their own handling.

## Style

White on black, no accent colours. Titles are large and light, secondary text is a lower opacity
of white, and buttons are white pills. New screens should reuse the existing stylesheets instead of
adding new colours.

## TV

`tv/` is a copy of this app tuned for the TV. Shared files such as `api/plugins.js`, `core/*` and
the player are kept identical: change both.
