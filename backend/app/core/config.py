from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql+asyncpg://nestify:Afynjv228@188.137.249.105:5432/nestify-db"
    )

    PROJECT_NAME: str = "HomeRezka-API"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "HomeRezka-API"
    MAIN_PAGE_URL: str = "https://rezka.ag"
    SEARCH_URL_BASE: str = "https://rezka.fi/search/?do=search&subaction=search&q="

    class Config:
        case_sensitive = True


settings = Settings()
