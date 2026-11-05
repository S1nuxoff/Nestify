"""What one-button playback needs to know about a profile: its voices and its last watch."""

from sqlalchemy import select

from app.db.session import async_session
from app.models.playback_preference import ANY_TITLE, PlaybackPreference
from app.models.users import User
from app.services.media.watch_history import get_last_watch_for_movie


class PlaybackStore:
    async def owns(self, account_id: int, user_id: int) -> bool:
        async with async_session() as session:
            profile = await session.get(User, user_id)
            return profile is not None and profile.account_id == account_id

    async def state(self, user_id: int, movie_id: str) -> dict:
        async with async_session() as session:
            rows = (await session.execute(
                select(PlaybackPreference).where(
                    PlaybackPreference.user_id == user_id,
                    PlaybackPreference.scope.in_([movie_id, ANY_TITLE]),
                )
            )).scalars().all()
        voices = {row.scope: row.voice for row in rows}
        last = await get_last_watch_for_movie(user_id, movie_id)
        return {
            "title_voice": voices.get(movie_id),
            "last_voice": voices.get(ANY_TITLE),
            "last_watch": last and {
                "season": last.season,
                "episode": last.episode,
                "position_seconds": last.position_seconds or 0,
                "duration": last.duration,
            },
        }

    async def save_voice(self, user_id: int, movie_id: str, voice: str, explicit: bool) -> None:
        """A voice picked automatically is kept for this title but is not the profile's choice."""
        scopes = [movie_id, ANY_TITLE] if explicit else [movie_id]
        async with async_session() as session:
            for scope in scopes:
                row = await session.get(PlaybackPreference, (user_id, scope))
                if row:
                    row.voice = voice
                else:
                    session.add(PlaybackPreference(user_id=user_id, scope=scope, voice=voice))
            await session.commit()
