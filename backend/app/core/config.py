from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://nestify:password@localhost:5432/nestify-db"

    PROJECT_NAME: str = "HomeRezka-API"
    VERSION: str = "1.4.5"
    DESCRIPTION: str = "HomeRezka-API"
    FRONTEND_BASE_URL: str = "https://opencine.cloud"
    API_BASE_URL: str = "http://localhost:8000"
    AUTH_SECRET_KEY: str = "change-this-auth-secret-in-production"
    AUTH_TOKEN_TTL_SECONDS: int = 60 * 60 * 24 * 30

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # v3 — Jackett + JacRed + TorrServe
    JACKETT_URL: str = ""
    JACKETT_KEY: str = ""
    JACKETT_INDEXERS: str = ""
    JACKETT_ENABLED: bool = False

    JACKETT_EN_INDEXERS: str = "yts,eztv,therarb,torrentgalaxy,thepiratebay,limetorrents,knaben"
    JACKETT_EN_ENABLED: bool = True

    JACKETT_PL_INDEXER: str = "polskie-torrenty"
    JACKETT_PL_ENABLED: bool = True

    JACRED_URL: str = "https://jac.red"
    JACRED_ENABLED: bool = True

    JACRED_OWN_URL: str = ""
    JACRED_OWN_ENABLED: bool = False

    TORRSERVE_URL: str = ""
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Rezka
    REZKA_MIRROR: str = "hdrezka-home.tv"
    REZKA_REPLACE_FROM: str = "rezka.ag,hdrezka.ag,rezka.fi,rezka.me,rezka.uno"
    REZKA_PROXY: str = ""

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # TMDB
    TMDB_KEY: str = ""
    TMDB_BASE: str = "https://api.themoviedb.org/3"
    TMDB_IMG: str = "https://image.tmdb.org/t/p"
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @property
    def REZKA_BASE_URL(self) -> str:
        return f"https://{self.REZKA_MIRROR}"

    @property
    def MAIN_PAGE_URL(self) -> str:
        return f"https://{self.REZKA_MIRROR}"

    @property
    def SEARCH_URL_BASE(self) -> str:
        return f"https://{self.REZKA_MIRROR}/search/?do=search&subaction=search&q="

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
