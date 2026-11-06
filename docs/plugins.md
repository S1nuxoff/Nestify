# Source plugins

A source plugin is a separate HTTP service that finds video for a title. An admin installs it by
its manifest URL. Nestify asks every enabled plugin for sources and plays what the user picks.

Plugins run on the server, not in the client. This is what makes sources tied to a server IP or
a session cookie work, and a plugin never gets access to a user's session.

## Protocol (version 1)

If the plugin was installed with a token, every request carries `Authorization: Bearer <token>`.
All responses are JSON with status 200. Redirects are not followed.

The manifest must be served at a path ending in `/manifest.json`. The other two methods are
relative to the same directory.

### `GET /manifest.json`

```json
{
  "id": "rezka",
  "name": "HDRezka",
  "version": "1.0.0",
  "api_version": 1,
  "description": "Optional",
  "kinds": ["direct"]
}
```

`id` is lowercase letters, digits, `-` and `_`. It must not change between versions.

### `POST /sources`

Request. Only `media_type` and `title` are always present. `season` and `episode` are sent only if
the plugin's results depend on them. `titles` holds names in other languages, for example
`{"en": "...", "pl": "..."}`:

```json
{
  "media_type": "tv",
  "title": "Лучше звоните Солу",
  "original_title": "Better Call Saul",
  "year": 2015,
  "tmdb_id": "60059",
  "imdb_id": "tt3032476",
  "season": 1,
  "episode": 1
}
```

Response. `id` is opaque to Nestify and comes back in `/resolve`, so it must carry whatever the
plugin needs to find the source again, including season and episode:

```json
{
  "sources": [
    {
      "id": "7769:238:1:1",
      "title": "Оригинал (+субтитры)",
      "kind": "direct",
      "voice": "Оригинал",
      "quality": "1080p",
      "language": "en",
      "size_bytes": 1047039930,
      "seeders": 10
    }
  ]
}
```

Only `id`, `title` and `kind` are required. At most 1000 sources per plugin are used, and a response
may be up to 4 MB.

`extra` is an optional object passed to the client as is. For `torrent` it holds `magnet` and may hold
`voices`, `videotype`, `peers`, `pub_date` and `tracker`. For `embed` it holds `embed`, the player data.
`language` for torrents is `uk`, `ru`, `en` or `pl`, which are the tabs of the source picker.

Nestify asks only the plugins whose manifest lists a kind it needs at that moment. The main Play button
asks for `direct` and `hls` and must be fast. The source picker asks for `torrent` and `embed`, which
may take up to 70 seconds, so `kinds` in the manifest must be accurate.

### `POST /resolve`

Called right before playback, so links can be short-lived. Request: `{"source_id": "7769:238:1:1"}`.

```json
{
  "kind": "direct",
  "playback": "proxy",
  "streams": [
    {"quality": "1080p", "url": "https://cdn.example/v.mp4", "headers": {"Referer": "https://example"}}
  ],
  "subtitles": [
    {"lang": "ru", "label": "Русский", "url": "https://cdn.example/ru.vtt"}
  ]
}
```

| `kind` | Required field | Meaning |
|---|---|---|
| `direct` | `streams` | A video file |
| `hls` | `streams` | An HLS playlist |
| `torrent` | `magnet` | A magnet link |
| `embed` | `embed_url` | A page to embed |

| `playback` | Meaning |
|---|---|
| `direct` | The client fetches `url` itself. `headers` are not allowed |
| `proxy` | Nestify fetches `url` and streams it to the client. The client never sees the URL or `headers`. Only for `kind: direct` |

Use `proxy` when a link works only from the server's IP or needs custom headers.

A response that breaks these rules is rejected, and the error is reported for that plugin only.

### `GET /settings` and `PUT /settings` (optional)

A plugin with settings gets a "Налаштувати" button on the extensions page, for admins only. Plugins
without them answer 404. Never return saved secrets here.

```json
{
  "status": {"ok": true, "message": "Сайт приймає куки", "expires_at": 1796467337},
  "fields": [{"key": "cookies", "label": "Куки", "placeholder": "Вставте значення cookie"}],
  "help": [{"text": "Відкрийте тунель:", "command": "ssh -D 1080 -N root@server"}]
}
```

`PUT` receives `{"values": {"cookies": "..."}}` and answers with the same object. To refuse, answer 400
with `{"detail": "..."}`: the text is shown to the admin.

## Backend API

All under `/api/v4`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/plugins` | admin | List plugins. Tokens are never returned |
| `POST` | `/plugins` | admin | Install: `{"manifest_url", "token"}` |
| `PATCH` | `/plugins/{id}` | admin | `{"enabled"}` and/or `{"token"}`. An empty token removes it |
| `POST` | `/plugins/{id}/refresh` | admin | Re-read the manifest |
| `DELETE` | `/plugins/{id}` | admin | Remove |
| `POST` | `/sources` | account | Ask this account's plugins, optionally only for some `kinds`. Returns `{"sources", "errors", "providers"}` |
| `POST` | `/resolve` | account | `{"plugin_id", "source_id"}`. Returns `{"kind", "streams", "subtitles", "magnet", "embed_url"}` |
| `GET` | `/play/{token}` | the link | Streams proxied media with `Range` support |
| `GET`, `PUT` | `/extensions/{id}/settings` | admin | Read and save a plugin's settings |

`/play` links are random, live for 6 hours and are kept in memory, so a backend restart invalidates
them and the client should call `/resolve` again. This requires the backend to run as one process.

Installing a plugin means trusting it: the backend calls its URLs and, with `proxy`, fetches
whatever URLs it returns. That is why only admins can install plugins.

## Tests

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests
```
