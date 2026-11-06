# HDRezka plugin

A Nestify [source plugin](../../docs/plugins.md). It finds a TMDB title on HDRezka, lists its
voice-overs for the requested episode and returns links with subtitles.

Links from the site work only from the server's IP, so Nestify streams them through the backend
(`playback: proxy`). The plugin is fast enough for the Play button.

## Finding a title

1. The `rezka_map` table, by TMDB id and then IMDb id. If several pages share an id, the page must
   also pass the name and year check below.
2. The site's own search. A title is accepted only if its name or original name matches exactly,
   the type matches and the year differs by at most one. What is found this way is saved to the
   table, so new releases get there without a crawler. Existing ids are never replaced.

If neither finds it, the plugin returns nothing: a wrong film is worse than none. If the table is
unavailable, search still works.

To fill the table from the mapper's SQLite database:

```bash
pip install asyncpg
DATABASE_URL=postgresql://... python scripts/import_mapping.py path/to/rezka_mapping.db
```

## Deploy in Dokploy

1. Create an Application in the same project as the backend: build type Dockerfile, build path
   `plugins/rezka`, no domain. The backend reaches it over `dokploy-network`.
2. Create a Postgres database for `rezka_map` and the saved settings, and set
   `REZKA_MAP_DATABASE_URL` to it.
3. Set the variables below and deploy.
4. In Nestify, as an admin: Профіль → Розширення → Додати за посиланням, with
   `http://<app name>:8000/manifest.json` and the `PLUGIN_TOKEN` value.

| Variable | Meaning |
|---|---|
| `PLUGIN_TOKEN` | Random secret, also given to Nestify when installing |
| `REZKA_MAP_DATABASE_URL` | Database for `rezka_map` and the saved cookies. Without it titles are found by name only and cookies can't be saved from the page |
| `REZKA_COOKIES` | Initial cookies. Cookies saved on the extensions page win over these |
| `REZKA_ORIGIN` | Site mirror, `https://rezka.ag` by default |
| `REZKA_USER_AGENT` | Must match the browser the cookies came from |
| `REZKA_HIDDEN_QUALITIES` | Qualities to hide, see below |
| `REZKA_SSH_KEY_NAME` | Key file name used in the renewal steps shown to admins |

## Cookies

The site checks for bots, and its cookie is tied to the IP that passed the check. So the cookie
has to come from a browser going through the server. It lasts about 30 days.

Renew it in Nestify, without a redeploy:

1. Профіль → Розширення. The HDRezka card shows the expiry date and turns red five days before.
2. Налаштувати. The window lists the steps with ready commands to copy:
   an SSH tunnel to the server (`ssh -D 1080 -N`), a separate Chrome going through it, then the
   `cookie` request header from DevTools.
3. Paste the cookie and press "Перевірити й зберегти".

The plugin checks the cookie against the site first. If the site accepts it, the cookie is saved in
the plugin's database and used at once. If not, nothing changes and the window says why. Cookie
values are never sent back to the page.

`GET /status` answers 503 while the cookie doesn't work, and Nestify shows the same error for this
plugin in `/api/v4/sources`.

## Quality labels

`1080p Ultra`, `2K` and `4K` need a premium account. Without one, the site serves a one-minute stub
for them, so they are hidden by default (`REZKA_HIDDEN_QUALITIES`). Clear it for a premium account.

Other labels are passed on as the site gives them, and they can overstate the real resolution. On
the titles checked, without premium, `1080p` was 1280 pixels wide and `720p` was 854.

## Tests

```bash
pip install -r requirements.txt httpx pytest
python -m pytest tests
```
