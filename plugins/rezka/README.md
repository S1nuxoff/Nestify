# HDRezka plugin

A Nestify [source plugin](../../docs/plugins.md). It finds a TMDB title on HDRezka, lists its
voice-overs for the requested episode and returns links with subtitles.

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

Create an Application in the same project as the backend:

- Build type: Dockerfile, build path `plugins/rezka`
- Environment: see `.env.example`
- No domain is needed: the backend reaches it over `dokploy-network`

Then install it from the backend as an admin:

```bash
curl -X POST https://<api>/api/v4/plugins \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"manifest_url": "http://<service name>:8000/manifest.json", "token": "<PLUGIN_TOKEN>"}'
```

## Cookies

The site protects itself with a bot check, and its cookie is tied to the IP it was issued to. So
the cookies must come from a browser going through the server:

1. `ssh -D 1080 -N root@<server>`
2. Start a separate browser with `--proxy-server="socks5://127.0.0.1:1080"`
3. Open the site, pass the check, and copy the `cookie` request header into `REZKA_COOKIES`

The cookie lasts about 30 days. `GET /status` answers 503 once it stops working, and Nestify shows
the same error for this plugin in `/api/v4/sources`.

## Quality labels

`1080p Ultra`, `2K` and `4K` need a premium account. Without one, the site serves a one-minute stub
for them, so they are hidden by default (`REZKA_HIDDEN_QUALITIES`).

Other labels are passed on as the site gives them, and they can overstate the real resolution. On
the titles checked, without premium, `1080p` was 1280 pixels wide and `720p` was 854.

## Tests

```bash
pip install -r requirements.txt httpx pytest
python -m pytest tests
```
