"""Glossary API contract."""

from datetime import datetime
from typing import Any

from pydantic import Field

from app.core.enums import EntryCategory, GlossaryAction, GlossaryStatus, ImportSkip, TermCategory
from app.core.schemas import ORM, Schema


class Term(Schema):
    """A highlighted term. `ok=False` means the glossary target is missing in the translation."""

    source: str
    target: str = ""
    category: TermCategory
    alternatives: list[str] = Field(default_factory=list)
    description: str = ""
    glossary_id: int | None = None
    dnt: bool = False
    ok: bool = True


class GlossaryIn(Schema):
    terms: dict[str, str] = Field(description='{"de": "Korpus", "en": "carcass"}')
    synonyms: dict[str, list[str]] = Field(default_factory=dict)
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


class DuplicateGroup(Schema):
    term: str
    lang: str
    ids: list[int]


class SkippedRow(Schema):
    row: int = Field(description="Row number in the sheet, the header being row 1")
    code: ImportSkip
    term: str = Field(default="", description="The term of a duplicate")
    reason: str = Field(description="German text of the reason, for API clients without their own wording")


class ImportResult(Schema):
    created: int
    updated: int
    skipped: int
    skipped_rows: list[SkippedRow]
