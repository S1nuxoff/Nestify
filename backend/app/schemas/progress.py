from pydantic import BaseModel, Field, NonNegativeInt


class ProgressIn(BaseModel):
    user_id: int = Field(..., example=42)
    movie_id: str = Field(..., example="spongebob")
    position_seconds: NonNegativeInt = Field(..., example=1234)
    season: int | None = Field(None, example=1)
    episode: int | None = Field(None, example=2)

    duration: NonNegativeInt | None = Field(
        None,
        example=5400,
        description="Загальна тривалість відео в секундах",
    )


class ProgressOut(BaseModel):
    position_seconds: NonNegativeInt
