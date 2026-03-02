import os
import json
import asyncpg

_PICKER_DB_DSN = os.environ.get(
    "PICKER_DB_DSN",
    "postgresql://postgres:z5w2wg1zuiypdlco@188.137.249.105:1122/postgres",
)

TMDB_IMG = "https://image.tmdb.org/t/p/w1280"


def _parse_tmdb(payload_tmdb: str | None) -> dict:
    if not payload_tmdb:
        return {}
    try:
        data = json.loads(payload_tmdb)
        raw = data.get("raw", {})
        result = (
            raw.get("movie_results") or
            raw.get("tv_results") or
            []
        )
        if not result:
            return {}
        r = result[0]
        backdrop = r.get("backdrop_path")
        poster = r.get("poster_path")
        return {
            "backdrop":     f"{TMDB_IMG}{backdrop}" if backdrop else None,
            "poster":       f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
            "rating":       round(r.get("vote_average", 0), 1) or None,
            "overview":     r.get("overview") or None,
            "release_date": (r.get("release_date") or r.get("first_air_date") or "")[:4] or None,
            "tmdb_title":   r.get("title") or r.get("name") or None,
        }
    except Exception:
        return {}


async def get_picker_movies(
    count: int = 30,
    content_type: str | None = None,
    genre_id: int | None = None,
) -> list[dict]:
    conn = await asyncpg.connect(_PICKER_DB_DSN)
    try:
        where = ["p.image IS NOT NULL", "p.image != ''"]
        params: list = []

        if content_type:
            params.append(content_type)
            where.append(f"p.type = ${len(params)}")

        if genre_id is not None:
            params.append(genre_id)
            idx = len(params)
            where.append(f"""(
                (m.payload_tmdb::jsonb #> '{{raw,movie_results,0,genre_ids}}') @> to_jsonb(${idx}::int)
                OR
                (m.payload_tmdb::jsonb #> '{{raw,tv_results,0,genre_ids}}') @> to_jsonb(${idx}::int)
            )""")

        params.append(count)
        where_sql = " AND ".join(where)

        rows = await conn.fetch(
            f"""
            SELECT
                p.rezka_link,
                p.rezka_slug,
                p.title,
                p.type,
                p.image,
                p.short_desc,
                m.payload_tmdb,
                m.tmdb_id,
                m.tmdb_type
            FROM rezka_page_items p
            LEFT JOIN rezka_mapping m ON m.rezka_link = p.rezka_link
            WHERE {where_sql}
            ORDER BY RANDOM()
            LIMIT ${len(params)}
            """,
            *params,
        )

        result = []
        for r in rows:
            tmdb = _parse_tmdb(r["payload_tmdb"])
            result.append({
                "link":       r["rezka_link"],
                "slug":       r["rezka_slug"],
                "title":      r["title"],
                "type":       r["type"],
                "image":      r["image"],
                "short_desc": r["short_desc"],
                "backdrop":   tmdb.get("backdrop"),
                "poster":     tmdb.get("poster"),
                "rating":     tmdb.get("rating"),
                "overview":   tmdb.get("overview"),
                "year":       tmdb.get("release_date"),
                "tmdb_title": tmdb.get("tmdb_title"),
                "tmdb_id":    r["tmdb_id"],
                "tmdb_type":  r["tmdb_type"],
            })
        return result
    finally:
        await conn.close()
