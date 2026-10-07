"""Settings API contract."""

from app.core.schemas import Schema


class SettingsOut(Schema):
    llm_provider: str
    llm_model: str
    default_source_lang: str
    default_export_format: str
    default_export_mode: str
    colors: dict[str, str]
    gemini_key_configured: bool = False
