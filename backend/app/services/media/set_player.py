# from app.db.session import async_session
# from sqlalchemy import select
# from app.models.now_playing import NowPlaying
# from app.models.movies import Movie


# async def set_now_playing(id):
#     async with async_session() as session:
#         async with session.begin():
#             existing_movie = await session.execute(
#                 select(NowPlaying).where(NowPlaying.movied == movie["id"])
#             )
#             existing_movie = existing_movie.scalars().first()
#             if existing_movie:
#                 return existing_movie

#             new_movie = NowPlaying(
#                 movie_id=movie["title"],
#                 translator_id=movie.get("translator_id"),
#                 season=movie.get("season"),
#                 episode=movie.get("episode"),
#                 position_seconds=movie.get("position_seconds"),
#                 started_at=movie.get("started_at"),
#             )
#             session.add(new_movie)
#             await session.commit()
#             return new_movie
