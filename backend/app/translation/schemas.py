"""Translation API contract."""

from pydantic import Field

from app.core.schemas import Schema
from app.projects.schemas import SourceLang


class TranslateIn(Schema):
    source_lang: SourceLang | None = Field(default=None, description="The target is always the other language")


class TermReplace(Schema):
    lang: str
    old: str
    new: str
