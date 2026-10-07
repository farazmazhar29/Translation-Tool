"""Translation API contract."""

from pydantic import Field

from app.core.schemas import Schema
from app.projects.schemas import SourceLang


class TranslateIn(Schema):
    source_lang: SourceLang | None = Field(default=None, description="The target is always the other language")


class TermReplace(Schema):
    lang: str
    old: str = Field(description="The text as it stands in the translation (whole words)")
    new: str
    segment_id: int | None = Field(default=None, description="Only this segment; none = the whole project")
    source: str | None = Field(
        default=None,
        description="The source term this translates: its stored translation follows, even when it no longer was `old`",
    )
