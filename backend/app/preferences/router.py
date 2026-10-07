"""Application settings."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.accounts.security import Admin, Me
from app.core.config import settings
from app.core.db import DB
from app.core.enums import AUTO, ExportMode, FileFormat, Provider, TermCategory
from app.preferences.models import AppSetting
from app.preferences.schemas import SettingsOut
from app.translation.llm import model_choices

router = APIRouter(prefix="/api")

DEFAULTS: dict[str, Any] = {
    "llm_provider": Provider.GEMINI,
    "llm_model": settings.gemini_model,
    "default_source_lang": AUTO,
    "default_export_format": FileFormat.DOCX,
    "default_export_mode": ExportMode.TRANSLATION,
    "colors": {
        TermCategory.TECHNICAL: "#3b82f6",
        TermCategory.GLOSSARY: "#22c55e",
        TermCategory.AMBIGUOUS: "#f59e0b",
        TermCategory.UNKNOWN: "#ef4444",
        TermCategory.PROTECTED: "#a855f7",
    },
}


def read_settings(db: DB) -> SettingsOut:
    row = db.get(AppSetting, "general")
    values = {**DEFAULTS, **(row.value if row else {})}
    if values["llm_provider"] not in model_choices():  # "mock" stored before it stopped being a choice
        values["llm_provider"] = DEFAULTS["llm_provider"]
    return SettingsOut.model_validate(
        {
            **values,
            "gemini_key_configured": bool(settings.gemini_api_key),
            "model_choices": model_choices(),
            "offline_mock": settings.llm_provider == Provider.MOCK,
        }
    )


def check_model(provider: object, model: object) -> None:
    """Only a provider the app offers and, for it, one of its models: a typo must not break every translation."""
    if provider not in model_choices():
        raise HTTPException(400, f"Unbekannter KI-Anbieter: {provider}")
    choices = model_choices()[str(provider)]
    if model not in choices:
        raise HTTPException(400, f"Unbekanntes Modell: {model}. Möglich: {', '.join(choices)}")


@router.get("/settings", tags=["Settings"])
def get_settings(db: DB, _: Me) -> SettingsOut:
    return read_settings(db)


@router.put("/settings", tags=["Settings"])
def put_settings(db: DB, _: Admin, body: dict[str, Any]) -> SettingsOut:
    values = {k: v for k, v in body.items() if k in DEFAULTS}
    row = db.get(AppSetting, "general") or AppSetting(key="general", value={})
    if "llm_provider" in values or "llm_model" in values:  # checked as they will be stored together
        current = read_settings(db)
        merged = {"llm_provider": current.llm_provider, "llm_model": current.llm_model, **values}
        check_model(merged["llm_provider"], merged["llm_model"])
    row.value = {**row.value, **values}
    db.add(row)
    db.commit()
    return read_settings(db)
