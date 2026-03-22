from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql+asyncpg://nestify:Afynjv228@188.137.249.105:5432/nestify-db"
    )

    PROJECT_NAME: str = "HomeRezka-API"
    VERSION: str = "1.4.5"
    DESCRIPTION: str = "HomeRezka-API"
    FRONTEND_BASE_URL: str = "https://opencine.cloud"

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🌐 REZKA — налаштування дзеркал
    #
    # REZKA_MIRROR — домен на який перенаправляти всі запити
    REZKA_MIRROR: str = "hdrezka-home.tv"
    #
    # REZKA_REPLACE_FROM — домени які будуть замінятись на REZKA_MIRROR
    # (через кому, без пробілів)
    REZKA_REPLACE_FROM: str = "rezka.ag,hdrezka.ag,rezka.fi,rezka.me,rezka.uno"
    #
    # REZKA_PROXY — проксі для v2 (HdRezkaApi). Пусто = без проксі
    # Приклад: "http://196.1.93.16:80"
    REZKA_PROXY: str = "http://196.1.93.16:80"
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
        case_sensitive = True


settings = Settings()
