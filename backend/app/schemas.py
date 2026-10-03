"""API contract (Pydantic). These models drive validation *and* the Swagger docs at /docs."""

from datetime import datetime
from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["technical", "glossary", "ambiguous", "unknown", "protected"]
Severity = Literal["error", "warning", "info"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- translation
class Term(BaseModel):
    """A highlighted term. `ok=False` means the glossary target is missing in the translation."""

    source: str
    target: str = ""
    category: Category
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


class Warning(BaseModel):
    segment_id: int | None
    idx: int
    lang: str
    type: str
    severity: Severity
    message: str


class QualityOut(BaseModel):
    warnings: list[Warning]
    errors: int
    glossary_version: int


# ---------------------------------------------------------------- projects
class ProjectOut(ORM):
    id: int
    name: str
    customer: str
    filename: str
    file_type: str
    source_lang: str
    detected_lang: str
    target_langs: list[str]
    status: str
    archived: bool
    job_state: str
    job_progress: int
    job_error: str
    structure: dict[str, Any]
    created_by: str
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectOut):
    segments: list[SegmentOut]


class ProjectPatch(BaseModel):
    name: str | None = None
    customer: str | None = None
    source_lang: str | None = None
    target_langs: list[str] | None = None


class TranslateIn(BaseModel):
    source_lang: str | None = None
    target_langs: list[str] | None = None


class JobStatus(ORM):
    job_state: str
    job_progress: int
    job_error: str
    status: str


class ExportIn(BaseModel):
    lang: str
    format: Literal["docx", "xlsx", "pdf"] = "docx"
    mode: Literal["translation", "both"] = "translation"
    include_report: bool = False
    include_comments: bool = False
    config: dict[str, Any] | None = Field(None, description="Excel layout, e.g. {source_col:'A', target_col:'C'}")
    template_id: int | None = None
    archive_after: bool = True


class ExportFileOut(ORM):
    id: int
    filename: str
    format: str
    lang: str
    mode: str
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
    warnings: list[Warning]


class HistoryOut(BaseModel):
    project: ProjectOut
    releases: list[ReleaseOut]
    exports: list[ExportFileOut]


class TemplateIn(BaseModel):
    name: str
    format: Literal["docx", "xlsx", "pdf"] = "xlsx"
    config: dict[str, Any]


class TemplateOut(TemplateIn, ORM):
    id: int


# ---------------------------------------------------------------- glossary
class GlossaryIn(BaseModel):
    terms: dict[str, str] = Field(description='{"de": "Korpus", "en": "carcass"}')
    synonyms: dict[str, list[str]] = {}
    description: str = ""
    category: Literal["technical", "product"] = "technical"
    do_not_translate: bool = False
    status: Literal["draft", "approved", "rejected"] | None = None
    force: bool = Field(False, description="Save even if a duplicate exists")


class GlossaryOut(ORM):
    id: int
    terms: dict[str, str]
    synonyms: dict[str, list[str]]
    description: str
    category: str
    do_not_translate: bool
    status: str
    version: int
    updated_by: str
    updated_at: datetime


class GlossaryVersionOut(ORM):
    id: int
    entry_version: int
    action: str
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


# ---------------------------------------------------------------- admin
class UserIn(BaseModel):
    username: str
    full_name: str = ""
    password: str = ""
    role: Literal["translator", "reviewer", "admin"] = "translator"
    active: bool = True


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Literal["translator", "reviewer", "admin"]
    active: bool


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
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
