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
        result = raw.get("movie_results") or raw.get("tv_results") or []
        if not result:
            return {}
        row = result[0]
        backdrop = row.get("backdrop_path")
        poster = row.get("poster_path")
        return {
            "backdrop": f"{TMDB_IMG}{backdrop}" if backdrop else None,
            "poster": f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
            "rating": round(row.get("vote_average", 0), 1) or None,
            "overview": row.get("overview") or None,
            "release_date": (row.get("release_date") or row.get("first_air_date") or "")[:4] or None,
            "tmdb_title": row.get("title") or row.get("name") or None,
        }
    except Exception:
        return {}


async def get_picker_movies(
    count: int = 30,
    content_type: str | None = None,
    genre_id: int | None = None,
    min_rating: float | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
) -> list[dict]:
    conn = await asyncpg.connect(_PICKER_DB_DSN)
    try:
        base_where = ["p.image IS NOT NULL", "p.image != ''"]
        base_params: list = []
        rating_sql = """
            COALESCE(
                NULLIF(m.payload_tmdb::jsonb #>> '{raw,movie_results,0,vote_average}', '')::numeric,
                NULLIF(m.payload_tmdb::jsonb #>> '{raw,tv_results,0,vote_average}', '')::numeric
            )
        """
        year_sql = """
            NULLIF(
                SUBSTRING(
                    COALESCE(
                        m.payload_tmdb::jsonb #>> '{raw,movie_results,0,release_date}',
                        m.payload_tmdb::jsonb #>> '{raw,tv_results,0,first_air_date}'
                    )
                    FROM 1 FOR 4
                ),
                ''
            )::int
        """

        if content_type:
            base_params.append(content_type)
            base_where.append(f"p.type = ${len(base_params)}")

        if genre_id is not None:
            base_params.append(genre_id)
            idx = len(base_params)
            base_where.append(
                f"""(
                (m.payload_tmdb::jsonb #> '{{raw,movie_results,0,genre_ids}}') @> to_jsonb(${idx}::int)
                OR
                (m.payload_tmdb::jsonb #> '{{raw,tv_results,0,genre_ids}}') @> to_jsonb(${idx}::int)
            )"""
            )

        if min_rating is not None:
            base_params.append(min_rating)
            base_where.append(f"{rating_sql} >= ${len(base_params)}")

        if year_from is not None:
            base_params.append(year_from)
            base_where.append(f"{year_sql} >= ${len(base_params)}")

        if year_to is not None:
            base_params.append(year_to)
            base_where.append(f"{year_sql} <= ${len(base_params)}")

        where_sql = " AND ".join(base_where)
        params = [*base_params, count]
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
        for row in rows:
            tmdb = _parse_tmdb(row["payload_tmdb"])
            result.append(
                {
                    "link": row["rezka_link"],
                    "slug": row["rezka_slug"],
                    "title": row["title"],
                    "type": row["type"],
                    "image": row["image"],
                    "short_desc": row["short_desc"],
                    "backdrop": tmdb.get("backdrop"),
                    "poster": tmdb.get("poster"),
                    "rating": tmdb.get("rating"),
                    "overview": tmdb.get("overview"),
                    "year": tmdb.get("release_date"),
                    "tmdb_title": tmdb.get("tmdb_title"),
                    "tmdb_id": row["tmdb_id"],
                    "tmdb_type": row["tmdb_type"],
                }
            )
        return result
    finally:
        await conn.close()
