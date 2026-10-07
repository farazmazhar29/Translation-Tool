"""Project, segment and translation API contract."""

from datetime import datetime
from typing import Any, Literal, cast

from pydantic import BaseModel, Field, field_validator

from app.core.enums import FileFormat, JobState, Lang, ProjectStatus
from app.core.schemas import ORM
from app.glossary.schemas import Term


class TranslationOut(ORM):
    text: str
    original_text: str
    terms: list[Term]
    comment: str
    edited: bool
    edited_by: str


class SegmentOut(ORM):
    id: int
    idx: int
    source_text: str
    locator: dict[str, Any]
    translations: dict[str, TranslationOut]

    @field_validator("translations", mode="before")
    @classmethod
    def by_lang(cls, v: Any) -> Any:
        return {t.lang: t for t in cast(list[Any], v)} if isinstance(v, list) else v


class SegmentEdit(BaseModel):
    text: str | None = None
    comment: str | None = None


class ProjectOut(ORM):
    id: int
    name: str
    customer: str
    filename: str
    file_type: FileFormat
    source_lang: str
    detected_lang: str
    target_langs: list[str] = Field(description="Always the other language; empty while the source is unknown")
    status: ProjectStatus
    archived: bool
    job_state: JobState
    job_progress: int
    job_error: str
    structure: dict[str, Any]
    created_by: str
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectOut):
    segments: list[SegmentOut]


SourceLang = Lang | Literal["auto"]  # "auto" = detect the language from the text (see enums.AUTO)


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    customer: str | None = Field(None, max_length=200)
    source_lang: SourceLang | None = None


class CellOut(BaseModel):
    ref: str = Field(description='Cell coordinate, e.g. "B5"; text cells match a segment locator "cell"')
    value: str | float
    decimals: int = Field(default=0, description="Decimals of the cell's number format")
    bold: bool = False


class SheetOut(BaseModel):
    name: str
    cells: list[CellOut]


class JobStatus(ORM):
    job_state: JobState
    job_progress: int
    job_error: str
    status: ProjectStatus
