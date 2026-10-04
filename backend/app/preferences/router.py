"""Application settings."""

from typing import Any

from fastapi import APIRouter

from app.accounts.security import Admin, Me
from app.core.config import settings
from app.core.db import DB
from app.core.enums import AUTO, ExportMode, FileFormat, Lang, TermCategory
from app.preferences.models import AppSetting
from app.preferences.schemas import SettingsOut

router = APIRouter(prefix="/api")

DEFAULTS: dict[str, Any] = {
    "llm_provider": settings.llm_provider,
    "llm_model": settings.gemini_model,
    "default_source_lang": AUTO,
    "default_target_langs": [Lang.EN],
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
    return SettingsOut.model_validate(
        {**DEFAULTS, **(row.value if row else {}), "gemini_key_configured": bool(settings.gemini_api_key)}
    )


@router.get("/settings", tags=["Settings"])
def get_settings(db: DB, _: Me) -> SettingsOut:
    return read_settings(db)


@router.put("/settings", tags=["Settings"])
def put_settings(db: DB, _: Admin, body: dict[str, Any]) -> SettingsOut:
    values = {k: v for k, v in body.items() if k in DEFAULTS}
    row = db.get(AppSetting, "general") or AppSetting(key="general", value={})
    row.value = {**row.value, **values}
    db.add(row)
    db.commit()
    return read_settings(db)
