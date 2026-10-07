"""Settings API contract."""

from pydantic import Field

from app.core.schemas import Schema


class SettingsOut(Schema):
    llm_provider: str
    llm_model: str
    default_source_lang: str
    default_export_format: str
    default_export_mode: str
    colors: dict[str, str]
    gemini_key_configured: bool = False
    model_choices: dict[str, list[str]] = Field(
        default_factory=dict, description="The providers and their models to choose from (read-only)"
    )
    offline_mock: bool = Field(
        default=False, description="The server runs with LLM_PROVIDER=mock: the choice above is not used (read-only)"
    )
