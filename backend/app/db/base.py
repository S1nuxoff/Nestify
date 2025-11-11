from app.db.session import engine
from app.models.base import Base

# Імпортуємо моделі тут — без імпорту зворотного
from app.models.movies import Movie
from app.models.watch_history import WatchHistory
from app.models.now_playing import NowPlaying
from app.models.users import User


async def create_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
