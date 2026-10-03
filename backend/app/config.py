from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore")

    database_url: str = f"sqlite:///{ROOT / 'data' / 'app.db'}"
    data_dir: Path = ROOT / "data"
    secret_key: str = "dev-secret-change-me"
    token_hours: int = 12

    # LLM: "gemini" or "mock"
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"  # alias: survives model retirements
    gemini_fallback_models: list[str] = ["gemini-3.1-flash-lite", "gemini-3-flash-preview"]
    batch_size: int = 15
    # free tier is rate limited: minimum pause between LLM calls (seconds)
    llm_min_interval: float = 4.0

    cors_origins: str = "http://localhost:5173,http://localhost:8080"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
(settings.data_dir / "uploads").mkdir(exist_ok=True)
(settings.data_dir / "exports").mkdir(exist_ok=True)
