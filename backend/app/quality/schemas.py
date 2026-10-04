"""Quality check API contract."""

from pydantic import BaseModel

from app.core.enums import Severity


class QualityWarning(BaseModel):
    segment_id: int | None
    idx: int
    lang: str
    type: str
    severity: Severity
    message: str


class QualityOut(BaseModel):
    warnings: list[QualityWarning]
    errors: int
    glossary_version: int
