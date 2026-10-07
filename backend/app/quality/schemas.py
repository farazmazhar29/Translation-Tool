"""Quality check API contract."""

from pydantic import BaseModel, Field

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
    key: str = ""  # identifies the finding across checks, so that it can be accepted
    accepted: bool = False  # looked at and accepted by the reviewer: no longer counted


class AcceptedIn(BaseModel):
    keys: list[str] = Field(description="All accepted findings of the project (`QualityWarning.key`); [] reopens all")


class QualityOut(BaseModel):
    warnings: list[QualityWarning]
    errors: int
    glossary_version: int
