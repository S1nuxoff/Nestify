"""Load the mapper's SQLite database into the plugin's rezka_map table. Safe to run again.

    DATABASE_URL=postgresql://... python import_mapping.py path/to/rezka_mapping.db

Existing rows are updated, except that a row is never replaced by an older one.
Full site and TMDB responses (payload_*) are not imported.
"""

import asyncio
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

import asyncpg

SCHEMA = """
CREATE TABLE IF NOT EXISTS rezka_map (
    rezka_path  TEXT PRIMARY KEY,
    rezka_id    TEXT,
    title       TEXT,
    type        TEXT,
    year        INTEGER,
    tmdb_id     TEXT,
    tmdb_type   TEXT,
    imdb_id     TEXT,
    status      TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rezka_map_tmdb ON rezka_map (tmdb_id, tmdb_type) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_rezka_map_imdb ON rezka_map (imdb_id) WHERE imdb_id IS NOT NULL;
"""
UPSERT = """
INSERT INTO rezka_map (rezka_path, rezka_id, title, type, year, tmdb_id, tmdb_type, imdb_id, status, updated_at)
SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[],
                     $6::text[], $7::text[], $8::text[], $9::text[], $10::timestamptz[])
ON CONFLICT (rezka_path) DO UPDATE SET
    rezka_id = EXCLUDED.rezka_id, title = EXCLUDED.title, type = EXCLUDED.type, year = EXCLUDED.year,
    tmdb_id = EXCLUDED.tmdb_id, tmdb_type = EXCLUDED.tmdb_type, imdb_id = EXCLUDED.imdb_id,
    status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
WHERE rezka_map.updated_at <= EXCLUDED.updated_at
"""
BATCH = 5000


def clean(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def to_row(link, rezka_id, title, kind, tmdb_id, tmdb_type, imdb_id, status, updated_at):
    path = urlparse(link).path
    year = re.search(r"-((?:19|20)\d{2})(?:-latest)?\.html$", path)
    stamp = datetime.fromisoformat(updated_at).replace(tzinfo=timezone.utc) if updated_at else datetime.now(timezone.utc)
    return (path, clean(rezka_id), clean(title), clean(kind), int(year.group(1)) if year else None,
            clean(tmdb_id), clean(tmdb_type), clean(imdb_id), clean(status), stamp)


async def main(sqlite_path: str) -> None:
    source = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
    rows = source.execute(
        "SELECT rezka_link, rezka_id, title, type, tmdb_id, tmdb_type, imdb_id, status, updated_at"
        " FROM rezka_mapping ORDER BY updated_at"
    )
    target = await asyncpg.connect(os.environ["DATABASE_URL"])
    await target.execute(SCHEMA)
    total = 0
    async with target.transaction():
        while batch := rows.fetchmany(BATCH):
            # One statement cannot touch a row twice, so duplicates within a batch keep the newest.
            unique = {row[0]: row for row in map(lambda r: to_row(*r), batch)}
            await target.execute(UPSERT, *map(list, zip(*unique.values())))
            total += len(batch)
    print("read from sqlite:", total)
    await target.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
