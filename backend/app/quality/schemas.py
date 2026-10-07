"""Quality check API contract."""

from pydantic import BaseModel

from app.core.enums import QualityCode, Severity


class QualityWarning(BaseModel):
    segment_id: int | None
    idx: int
    lang: str
    type: str
    code: QualityCode | None = None  # absent in findings stored before the codes existed
    params: dict[str, str] = {}  # the values of the sentence for `code`
    severity: Severity
    message: str  # German; reports and exports use it, the interface builds its own from `code`


class QualityOut(BaseModel):
    warnings: list[QualityWarning]
    errors: int
    glossary_version: int
