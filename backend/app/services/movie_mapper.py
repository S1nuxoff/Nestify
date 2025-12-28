from __future__ import annotations

from typing import Any, Optional


def _to_int(x: Any) -> Optional[int]:
    try:
        if x is None:
            return None
        if isinstance(x, int):
            return x
        s = str(x).strip()
        if not s:
            return None
        # Rezka duration часто "108 мин." -> витягнемо число
        m = re.search(r"(\d+)", s)
        return int(m.group(1)) if m else None
    except Exception:
        return None


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        return float(x)
    except Exception:
        return None


def build_movie_payload(
    *,
    rezka_basic: dict,
    rezka_info: dict,
    rezka_actors: list[dict],
    trailer_rezka: str,
    imdb_id: Optional[str],
    tmdb_pack: dict,
    # ✅ серіальні штуки (Rezka)
    season_ids: list[str] | None = None,
    episodes_schedule: list | None = None,
    translators: list[dict] | None = None,
    selected_season: Optional[int] = None,
    selected_episode: Optional[int] = None,
) -> dict:
    tmdb = (tmdb_pack or {}).get("tmdb") or {}
    tmdb_images = (tmdb.get("images") or {}) if isinstance(tmdb, dict) else {}

    # type: якщо TMDB знайшов — беремо звідти, інакше пробуємо вгадати по rezka
    tmdb_type = tmdb.get("type") if tmdb else None

    # heuristics: якщо є сезони/епізоди — це серіал
    is_series = bool(season_ids) or bool(episodes_schedule)
    content_type = tmdb_type or ("tv" if is_series else "movie")

    runtime_min = _to_int(tmdb.get("runtime")) or _to_int(rezka_basic.get("duration"))

    series_block = None
    if is_series or content_type == "tv":
        series_block = {
            "selected": {
                "season": selected_season,
                "episode": selected_episode,
            },
            "seasons": {
                "ids": season_ids or [],
                "schedule": episodes_schedule or [],
                # ✅ якщо хочеш: tmdb totals
                "tmdb_totals": (
                    {
                        "number_of_seasons": tmdb.get("number_of_seasons"),
                        "number_of_episodes": tmdb.get("number_of_episodes"),
                    }
                    if tmdb
                    else None
                ),
            },
            "translators": translators or [],
            "tmdb": (
                {
                    "last_air_date": tmdb.get("last_air_date"),
                    "status": tmdb.get("status"),
                }
                if tmdb
                else None
            ),
        }

    payload = {
        "id": str(rezka_basic.get("film_id") or ""),
        "type": content_type,
        "title": rezka_basic.get("title") or "",
        "origin_name": rezka_basic.get("origin_name") or "",
        "description": rezka_basic.get("description") or "",
        "runtime_min": runtime_min,
        "release_date": {
            "rezka": rezka_info.get("release_date"),
            "tmdb": tmdb.get("release_date"),
        },
        "rating": {
            "rezka": rezka_basic.get("rate"),
            "tmdb": (
                {
                    "avg": tmdb.get("vote_average"),
                    "count": tmdb.get("vote_count"),
                }
                if tmdb
                else None
            ),
        },
        "external_ids": {
            "imdb": imdb_id,
            "tmdb": (
                {
                    "type": tmdb.get("type"),
                    "id": tmdb.get("id"),
                }
                if tmdb
                else None
            ),
        },
        "images": {
            "poster": {
                "rezka": rezka_basic.get("source_link"),
                "tmdb": tmdb.get("poster_url") or tmdb_images.get("poster_url"),
                "tmdb_original": tmdb.get("poster_url_original")
                or tmdb_images.get("poster_url_original"),
            },
            "backdrop": {
                "tmdb": tmdb.get("backdrop_url") or tmdb_images.get("backdrop_url"),
                "tmdb_original": tmdb.get("backdrop_url_original")
                or tmdb_images.get("backdrop_url_original"),
            },
            "logo": {
                "tmdb": tmdb.get("logo_url") or tmdb_images.get("logo_url"),
                "tmdb_original": tmdb.get("logo_url_original")
                or tmdb_images.get("logo_url_original"),
            },
        },
        "credits": {
            "cast": {
                "rezka": rezka_actors or [],
                "tmdb": tmdb.get("cast") or [],
            },
            "crew": {
                "tmdb": tmdb.get("crew") or [],
            },
        },
        "trailers": {
            "rezka": trailer_rezka or "",
            "tmdb_youtube": tmdb.get("trailer_youtube"),
            "tmdb": tmdb.get("trailer"),
        },
        # ✅ головне: блок серіалу (або None)
        "series": series_block,
        "meta": {
            "country_rezka": rezka_info.get("country"),
            "genres_rezka": rezka_info.get("genre") or [],
            "directors_rezka": rezka_info.get("director") or [],
            "age_rezka": rezka_info.get("age"),
        },
        "source": {"rezka": {"link": rezka_basic.get("link") or None}},
    }

    return payload
