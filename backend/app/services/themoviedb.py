from __future__ import annotations

import os
from typing import Any, Optional, Literal

import httpx

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "4ef0d7355d9ffb5151e987764708ce96")
TMDB_BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p"

TmdbType = Literal["movie", "tv"]


def tmdb_img(path: Optional[str], size: str = "w1280") -> Optional[str]:
    if not path:
        return None
    return f"{IMG_BASE}/{size}{path}"


def _pick_best(
    items: list[dict], *, prefer_langs: list[str] | None = None
) -> Optional[dict]:
    if not items:
        return None
    prefer_langs = prefer_langs or ["en", "uk", "pl", "ru", None]

    def lang_rank(x: dict) -> int:
        lang = x.get("iso_639_1")
        try:
            return prefer_langs.index(lang)
        except ValueError:
            return len(prefer_langs) + 1

    def score(x: dict) -> tuple:
        return (
            -lang_rank(x),
            float(x.get("vote_average") or 0.0),
            int(x.get("width") or 0),
            int(x.get("height") or 0),
        )

    return sorted(items, key=score, reverse=True)[0]


def _pick_best_video(videos: dict | None) -> Optional[dict]:
    results = (videos or {}).get("results") or []
    if not results:
        return None

    def score(v: dict) -> tuple:
        is_yt = 1 if v.get("site") == "YouTube" else 0
        t = v.get("type") or ""
        type_rank = 3 if t == "Trailer" else 2 if t == "Teaser" else 1
        official = 1 if v.get("official") else 0
        size = int(v.get("size") or 0)
        return (is_yt, type_rank, official, size)

    return sorted(results, key=score, reverse=True)[0]


def _norm_genres(genres: list[dict] | None) -> list[str]:
    if not genres:
        return []
    return [g["name"] for g in genres if g.get("name")]


def _norm_countries(d: dict, tmdb_type: TmdbType) -> list[str]:
    if tmdb_type == "movie":
        pcs = d.get("production_countries") or []
        return [c.get("name") for c in pcs if c.get("name")] or []
    oc = d.get("origin_country") or []
    return [x for x in oc if x]


def _norm_languages(d: dict) -> list[str]:
    langs = d.get("spoken_languages") or []
    return [
        x.get("english_name") or x.get("name")
        for x in langs
        if (x.get("english_name") or x.get("name"))
    ]


def _norm_runtime(d: dict, tmdb_type: TmdbType) -> Optional[int]:
    if tmdb_type == "movie":
        r = d.get("runtime")
        return int(r) if isinstance(r, (int, float)) else None
    runtimes = d.get("episode_run_time") or []
    if runtimes:
        try:
            return int(runtimes[0])
        except Exception:
            return None
    return None


def _norm_title(d: dict, tmdb_type: TmdbType) -> tuple[Optional[str], Optional[str]]:
    if tmdb_type == "movie":
        return d.get("title"), d.get("original_title")
    return d.get("name"), d.get("original_name")


def _norm_dates(d: dict, tmdb_type: TmdbType) -> tuple[Optional[str], Optional[str]]:
    if tmdb_type == "movie":
        return d.get("release_date"), None
    return d.get("first_air_date"), d.get("last_air_date")


def _norm_status(d: dict) -> Optional[str]:
    return d.get("status")


def _norm_seasons_episodes(
    d: dict, tmdb_type: TmdbType
) -> tuple[Optional[int], Optional[int]]:
    if tmdb_type != "tv":
        return None, None
    ns = d.get("number_of_seasons")
    ne = d.get("number_of_episodes")
    return (
        int(ns) if isinstance(ns, (int, float)) else None,
        int(ne) if isinstance(ne, (int, float)) else None,
    )


def _norm_cast(credits: dict | None) -> list[dict]:
    cast = (credits or {}).get("cast") or []
    out: list[dict] = []
    for c in cast[:20]:
        out.append(
            {
                "tmdb_id": c.get("id"),
                "name": c.get("name"),
                "character": c.get("character"),
                "order": c.get("order"),
                "profile_url": tmdb_img(c.get("profile_path"), "w185"),
                "profile_url_original": tmdb_img(c.get("profile_path"), "original"),
            }
        )
    return out


def _norm_crew(credits: dict | None) -> list[dict]:
    crew = (credits or {}).get("crew") or []
    out: list[dict] = []
    keep_jobs = {
        "Director",
        "Writer",
        "Screenplay",
        "Producer",
        "Executive Producer",
        "Composer",
        "Director of Photography",
    }
    for c in crew:
        job = c.get("job")
        if job not in keep_jobs:
            continue
        out.append(
            {
                "tmdb_id": c.get("id"),
                "name": c.get("name"),
                "job": job,
                "department": c.get("department"),
            }
        )
        if len(out) >= 20:
            break
    return out


def _prefer_langs_from_include(include_image_language: str) -> list[str]:
    prefer_langs: list[str] = []
    for x in (include_image_language or "").split(","):
        x = x.strip()
        if x == "null":
            prefer_langs.append(None)  # type: ignore[arg-type]
        elif x:
            prefer_langs.append(x)
    return prefer_langs or ["uk", "en", None]


def _norm_images(d: dict, images: dict | None, *, prefer_langs: list[str]) -> dict:
    images = images or {}
    posters = images.get("posters") or []
    backdrops = images.get("backdrops") or []
    logos = images.get("logos") or []

    poster_best = _pick_best(posters, prefer_langs=prefer_langs)
    logo_best = _pick_best(logos, prefer_langs=prefer_langs)

    details_backdrop_path = d.get("backdrop_path")
    if details_backdrop_path:
        backdrop_url = tmdb_img(details_backdrop_path, "w1280")
        backdrop_url_original = tmdb_img(details_backdrop_path, "original")
    else:
        backdrop_best = _pick_best(backdrops, prefer_langs=prefer_langs)
        backdrop_url = tmdb_img((backdrop_best or {}).get("file_path"), "w1280")
        backdrop_url_original = tmdb_img(
            (backdrop_best or {}).get("file_path"), "original"
        )

    return {
        "poster_url": tmdb_img((poster_best or {}).get("file_path"), "w500"),
        "poster_url_original": tmdb_img(
            (poster_best or {}).get("file_path"), "original"
        ),
        "backdrop_url": backdrop_url,
        "backdrop_url_original": backdrop_url_original,
        "logo_url": tmdb_img((logo_best or {}).get("file_path"), "w500"),
        "logo_url_original": tmdb_img((logo_best or {}).get("file_path"), "original"),
    }


async def tmdb_by_imdb(
    imdb_id: str,
    *,
    language: str = "uk-UA",
    include_image_language: str = "uk,en,null",
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    if not TMDB_API_KEY or not imdb_id:
        return {}

    params = {"api_key": TMDB_API_KEY, "language": language}

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(
            f"{TMDB_BASE}/find/{imdb_id}",
            params={**params, "external_source": "imdb_id"},
            headers={"accept": "application/json"},
        )
        r.raise_for_status()
        found = r.json() or {}

        tmdb_type: Optional[TmdbType] = None
        tmdb_id: Optional[int] = None

        if found.get("movie_results"):
            tmdb_type = "movie"
            tmdb_id = found["movie_results"][0].get("id")
        elif found.get("tv_results"):
            tmdb_type = "tv"
            tmdb_id = found["tv_results"][0].get("id")

        if not tmdb_type or not tmdb_id:
            return {}

    return await tmdb_by_id(
        tmdb_id,
        tmdb_type=tmdb_type,
        language=language,
        include_image_language=include_image_language,
        timeout_s=timeout_s,
    )


async def tmdb_by_id(
    tmdb_id: int,
    *,
    tmdb_type: TmdbType = "movie",
    language: str = "uk-UA",
    include_image_language: str = "uk,en,null",
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    if not TMDB_API_KEY or not tmdb_id:
        return {}

    params = {"api_key": TMDB_API_KEY, "language": language}
    append = "credits,videos,images,external_ids,alternative_titles,release_dates,content_ratings"

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(
            f"{TMDB_BASE}/{tmdb_type}/{tmdb_id}",
            params={
                **params,
                "append_to_response": append,
                "include_image_language": include_image_language,
            },
            headers={"accept": "application/json"},
        )
        r.raise_for_status()
        d: dict = r.json() or {}

    prefer_langs = _prefer_langs_from_include(include_image_language)
    img_pack = _norm_images(d, d.get("images") or {}, prefer_langs=prefer_langs)

    best_video = _pick_best_video(d.get("videos"))
    trailer_url = None
    if best_video and best_video.get("site") == "YouTube" and best_video.get("key"):
        trailer_url = f"https://www.youtube.com/watch?v={best_video['key']}"

    title, original_title = _norm_title(d, tmdb_type)
    release_date, last_air_date = _norm_dates(d, tmdb_type)
    runtime = _norm_runtime(d, tmdb_type)
    ns, ne = _norm_seasons_episodes(d, tmdb_type)

    external_ids = d.get("external_ids") or {}

    tmdb_payload = {
        "type": tmdb_type,
        "id": tmdb_id,
        "imdb_id": external_ids.get("imdb_id"),
        "title": title,
        "original_title": original_title,
        "overview": d.get("overview"),
        "tagline": d.get("tagline") or "",
        "release_date": release_date,
        "last_air_date": last_air_date,
        "runtime": runtime,
        "number_of_seasons": ns,
        "number_of_episodes": ne,
        "status": _norm_status(d),
        "homepage": d.get("homepage"),
        "popularity": d.get("popularity"),
        "vote_average": d.get("vote_average"),
        "vote_count": d.get("vote_count"),
        "genres": _norm_genres(d.get("genres")),
        "production_countries": _norm_countries(d, tmdb_type),
        "spoken_languages": _norm_languages(d),
        "images": img_pack,
        "poster_url": img_pack.get("poster_url"),
        "poster_url_original": img_pack.get("poster_url_original"),
        "backdrop_url": img_pack.get("backdrop_url"),
        "backdrop_url_original": img_pack.get("backdrop_url_original"),
        "logo_url": img_pack.get("logo_url"),
        "logo_url_original": img_pack.get("logo_url_original"),
        "trailer_youtube": trailer_url,
        "trailer": best_video,
        "cast": _norm_cast(d.get("credits")),
        "crew": _norm_crew(d.get("credits")),
        "external_ids": external_ids,
    }

    return {"tmdb": tmdb_payload}
