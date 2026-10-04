"""API contract (Pydantic). These models drive validation *and* the Swagger docs at /docs."""

from datetime import datetime
from typing import Any, Literal, Self, cast

from openpyxl.utils import column_index_from_string
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .enums import (
    EntryCategory,
    ExportMode,
    FileFormat,
    GlossaryAction,
    GlossaryStatus,
    JobState,
    Lang,
    ProjectStatus,
    Role,
    Severity,
    TermCategory,
)

MAX_EXCEL_COLUMN = 16384  # XFD
SourceLang = Lang | Literal["auto"]  # "auto" = detect the language from the text (see enums.AUTO)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# translation
class Term(BaseModel):
    """A highlighted term. `ok=False` means the glossary target is missing in the translation."""

    source: str
    target: str = ""
    category: TermCategory
    alternatives: list[str] = []
    description: str = ""
    glossary_id: int | None = None
    dnt: bool = False
    ok: bool = True


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


class TermReplace(BaseModel):
    lang: str
    old: str
    new: str


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


# projects
class ProjectOut(ORM):
    id: int
    name: str
    customer: str
    filename: str
    file_type: FileFormat
    source_lang: str
    detected_lang: str
    target_langs: list[str]
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


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    customer: str | None = Field(None, max_length=200)
    source_lang: SourceLang | None = None
    target_langs: list[Lang] | None = None


class TranslateIn(BaseModel):
    source_lang: SourceLang | None = None
    target_langs: list[Lang] | None = None


class JobStatus(ORM):
    job_state: JobState
    job_progress: int
    job_error: str
    status: ProjectStatus


class ExcelLayout(BaseModel):
    """Free choice of columns for Excel exports ("Erweiterte Einstellungen"). An empty column letter omits it."""

    sheet_name: str = Field("Übersetzung", min_length=1, max_length=31)  # Excel's own limit
    source_col: str = Field("A", pattern=r"^[A-Za-z]{1,3}$")
    target_col: str = Field("B", pattern=r"^[A-Za-z]{1,3}$")
    comment_col: str = Field("C", pattern=r"^[A-Za-z]{0,3}$")
    location_col: str = Field("", pattern=r"^[A-Za-z]{0,3}$")
    start_row: int = Field(2, ge=1, le=100_000)
    header: bool = True

    @field_validator("sheet_name")
    @classmethod
    def valid_sheet_name(cls, v: str) -> str:
        if any(c in v for c in "[]:*?/\\"):
            raise ValueError("Blattname darf keines der Zeichen [ ] : * ? / \\ enthalten")
        return v

    @model_validator(mode="after")
    def valid_columns(self) -> Self:
        used = [c.upper() for c in (self.source_col, self.target_col, self.comment_col, self.location_col) if c]
        if any(column_index_from_string(c) > MAX_EXCEL_COLUMN for c in used):
            raise ValueError("Spalte liegt außerhalb des Excel-Bereichs (A–XFD)")
        if len(set(used)) != len(used):
            raise ValueError("Jede Spalte darf nur einmal verwendet werden")
        return self


class ExportIn(BaseModel):
    lang: str
    format: FileFormat = FileFormat.DOCX
    mode: ExportMode = ExportMode.TRANSLATION
    include_report: bool = False
    include_comments: bool = False
    config: ExcelLayout | None = Field(None, description="Excel column layout (only used for .xlsx)")
    template_id: int | None = None
    archive_after: bool = True


class ExportFileOut(ORM):
    id: int
    filename: str
    format: FileFormat
    lang: str
    mode: ExportMode
    created_by: str
    created_at: datetime
    release_id: int


class ReleaseOut(ORM):
    id: int
    approved_by: str
    editors: list[str]
    created_at: datetime
    glossary_version: int
    change_count: int
    warnings: list[QualityWarning]


class ReleaseDetail(ReleaseOut):
    """One approved version: what the machine produced (preview) and what was approved (final), per segment id."""

    preview: dict[str, Any]
    final: dict[str, Any]


class HistoryOut(BaseModel):
    project: ProjectOut
    releases: list[ReleaseOut]
    exports: list[ExportFileOut]


class TemplateIn(BaseModel):
    name: str
    format: Literal[FileFormat.XLSX] = FileFormat.XLSX  # only Excel exports have a configurable layout
    config: ExcelLayout


class TemplateOut(TemplateIn, ORM):
    id: int


# glossary
class GlossaryIn(BaseModel):
    terms: dict[str, str] = Field(description='{"de": "Korpus", "en": "carcass"}')
    synonyms: dict[str, list[str]] = {}
    description: str = ""
    category: EntryCategory = EntryCategory.TECHNICAL
    do_not_translate: bool = False
    status: GlossaryStatus | None = None
    force: bool = Field(False, description="Save even if a duplicate exists")


class GlossaryOut(ORM):
    id: int
    terms: dict[str, str]
    synonyms: dict[str, list[str]]
    description: str
    category: EntryCategory
    do_not_translate: bool
    status: GlossaryStatus
    version: int
    updated_by: str
    updated_at: datetime


class GlossaryVersionOut(ORM):
    id: int
    entry_version: int
    action: GlossaryAction
    data: dict[str, Any]
    changed_by: str
    changed_at: datetime


class DuplicateGroup(BaseModel):
    term: str
    lang: str
    ids: list[int]


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    skipped_rows: list[dict[str, Any]]


# admin
class UserIn(BaseModel):
    username: str
    full_name: str = ""
    password: str = ""
    role: Role = Role.TRANSLATOR
    active: bool = True


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Role
    active: bool


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 (OAuth2 token type, not a secret)
    user: UserOut


class SettingsOut(BaseModel):
    llm_provider: str
    llm_model: str
    default_source_lang: str
    default_target_langs: list[str]
    default_export_format: str
    default_export_mode: str
    colors: dict[str, str]
    gemini_key_configured: bool = False


class TopTerm(BaseModel):
    id: int
    term: str
    count: int


class Stats(BaseModel):
    projects_total: int
    segments: int
    translations: int
    manual_edits: int
    glossary_entries: int
    by_language: dict[str, int]
    releases_per_day: dict[str, int]


class DashboardOut(BaseModel):
    open: int
    in_review: int
    approved: int
    edited_today: int
    recent: list[ProjectOut]
    top_terms: list[TopTerm]
    stats: Stats
