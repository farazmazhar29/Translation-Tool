"""Settings API contract."""

from pydantic import BaseModel


class SettingsOut(BaseModel):
    llm_provider: str
    llm_model: str
    default_source_lang: str
    default_target_langs: list[str]
    default_export_format: str
    default_export_mode: str
    colors: dict[str, str]
    gemini_key_configured: bool = False
