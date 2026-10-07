"""Translation API contract."""

from pydantic import BaseModel, Field

from app.projects.schemas import SourceLang


class TranslateIn(BaseModel):
    source_lang: SourceLang | None = Field(default=None, description="The target is always the other language")


class TermReplace(BaseModel):
    lang: str
    old: str
    new: str
