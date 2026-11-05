# Torrents plugin

A Nestify [source plugin](../../docs/plugins.md). It searches JacRed (Ukrainian and Russian releases)
and Jackett (English and Polish), and looks up the domem embedded player.

It only finds torrents. Playback stays in Nestify: its TorrServer and HLS engine take the magnet link.

Search can take tens of seconds, so Nestify never asks this plugin when the main Play button starts
a video, only when the source picker opens.

## Deploy in Dokploy

Create an Application in the same project as the backend:

- Build type: Dockerfile, Docker File `plugins/torrents/Dockerfile`, context `plugins/torrents`
- Environment: see `.env.example`
- No domain is needed: the backend reaches it over `dokploy-network`

Then install it on the extensions page in Nestify, under "Додати за посиланням":

- Link: `http://<app name>:8000/manifest.json`
- Token: the `PLUGIN_TOKEN` value

## Tests

```bash
pip install -r requirements.txt pytest
python -m pytest tests
```
