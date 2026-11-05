"""Runs PluginStore against a real SQL database (SQLite here, Postgres in production)."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.source_plugin import SourcePlugin
from app.plugins import store as store_module
from app.plugins.store import PluginStore


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def store(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(SourcePlugin.__table__.create)
    monkeypatch.setattr(
        store_module, "async_session",
        sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False),
    )
    yield PluginStore()
    await engine.dispose()


def make(plugin_id, name, enabled=True):
    return SourcePlugin(
        id=plugin_id, name=name, version="1", manifest_url="https://p/manifest.json",
        base_url="https://p", token="t", enabled=enabled, manifest={"kinds": ["direct"]},
    )


@pytest.mark.anyio
async def test_add_get_list(store):
    await store.add(make("b", "B"))
    await store.add(make("a", "A", enabled=False))
    assert (await store.get("b")).manifest == {"kinds": ["direct"]}
    assert await store.get("none") is None
    assert [p.id for p in await store.list()] == ["a", "b"]
    assert [p.id for p in await store.list(enabled_only=True)] == ["b"]


@pytest.mark.anyio
async def test_update_and_delete(store):
    await store.add(make("a", "A"))
    updated = await store.update("a", enabled=False, token=None)
    assert updated.enabled is False and updated.token is None
    assert (await store.get("a")).enabled is False
    assert await store.update("none", enabled=True) is None
    assert await store.delete("a") is True
    assert await store.delete("a") is False
