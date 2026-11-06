# Nestify Backend

FastAPI service behind the web and TV clients: accounts and profiles, watch history, playback,
source plugins, TV pairing and live sessions.

## Run

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload       # http://localhost:8000
```

Missing tables are created at startup (`create_all_tables`). Startup does not run Alembic, so a new
column on an existing table needs a manual migration before the deploy.

Run it as **one process**: proxied `/play` links and live sessions are kept in memory.

## Configuration

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres, `postgresql+asyncpg://...` |
| `AUTH_SECRET_KEY` | Signs login tokens |
| `FRONTEND_BASE_URL`, `API_BASE_URL` | Public addresses, used in links and TV pairing |
| `TMDB_KEY` | TMDB API key |
| `TORRSERVE_URL` | TorrServer, internal address such as `http://torrserve:8090` |
| `JACKETT_*`, `JACRED_*` | Legacy torrent search in `/api/v3`, also used by the torrents plugin |
| `REZKA_*` | Legacy HDRezka endpoints in `/api/v1`. New playback uses the plugin |

Admins can override some of these at runtime on the admin page; the values are stored in
`app_settings`.

## API versions

| Prefix | Contents |
|---|---|
| `/api/v1` | Auth, accounts, profiles, admin settings |
| `/api/v2` | Old streaming endpoints |
| `/api/v3` | Torrent search, HLS, history, featured, TV devices |
| `/api/v4` | Plugins, sources, resolve, proxied playback, playback preferences, extensions |

`/api/v4` is described in [docs/plugins.md](../docs/plugins.md).

## Layout

```text
app/
  api/v1..v4/     Routers, one folder per version
  plugins/        Plugin client, store, per-account install, /play links, playback preferences
  services/       TMDB, TorrServer, HLS (ffmpeg), Jackett, HDRezka, sessions
  models/         SQLAlchemy models
  websockets/     Live sessions and the player hub for "play on TV"
  core/config.py  Settings from the environment
```

### Accounts and profiles

An account logs in, profiles (`users`) belong to it. A profile with `role = admin` makes its account
an admin account: it can install plugins and sees extension settings.

### Plugins on an account

Every enabled plugin is installed on every account by default. Removing one on the extensions page
adds a row to `account_plugins`, so the choice holds for all profiles of that account.

## Tests

```bash
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests
```

The tests cover the plugin protocol, the client's limits, per-account install, playback
preferences and plugin settings. They need no database: the SQL tests use SQLite in memory.
