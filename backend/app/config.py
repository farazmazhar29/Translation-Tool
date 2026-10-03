from pathlib import Path
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
DEV_SECRET = "dev-only-insecure-secret-key-change-me"  # noqa: S105  (refused in production, see validator)


class Settings(BaseSettings):
    """All configuration comes from environment variables / `.env` (12-factor)."""

    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = ""  # default: SQLite inside DATA_DIR; use postgresql+psycopg2://... in production
    data_dir: Path = ROOT / "data"
    auto_migrate: bool = True  # run Alembic at startup; set false when migrations run as a separate deploy step

    # Auth
    secret_key: str = DEV_SECRET
    token_hours: int = 12
    login_max_failures: int = 5  # per IP + username ...
    login_window_minutes: int = 15  # ... within this window
    seed_demo_data: bool = True  # demo users and sample glossary; must be off in production
    bootstrap_admin_username: str = ""  # optional first admin when no users exist (production)
    bootstrap_admin_password: str = ""

    # Uploads
    max_upload_mb: int = 20

    # LLM provider: gemini | mock
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"  # alias: survives model retirements
    gemini_fallback_models: list[str] = ["gemini-3.1-flash-lite", "gemini-3-flash-preview"]
    batch_size: int = 15
    llm_min_interval: float = 4.0  # free tier is rate limited: minimum pause between LLM calls (seconds)

    # HTTP / observability
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    enable_hsts: bool = False  # turn on when the app is served over HTTPS
    docs_enabled: bool = True  # Swagger UI at /docs
    log_level: str = "INFO"
    log_format: Literal["text", "json"] = "text"

    @model_validator(mode="after")
    def default_database(self) -> Self:
        if not self.database_url:
            self.database_url = f"sqlite:///{self.data_dir / 'app.db'}"
        return self

    @model_validator(mode="after")
    def refuse_insecure_production(self) -> Self:
        if self.environment != "production":
            return self
        problems: list[str] = []
        if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
            problems.append("SECRET_KEY must be set to a random value of at least 32 characters")
        if self.seed_demo_data:
            problems.append("SEED_DEMO_DATA must be false (demo users have well-known passwords)")
        if problems:
            raise ValueError("Insecure production configuration: " + "; ".join(problems))
        return self


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
(settings.data_dir / "uploads").mkdir(exist_ok=True)
(settings.data_dir / "exports").mkdir(exist_ok=True)
