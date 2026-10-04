"""Translation API contract."""

from pydantic import BaseModel

from app.core.enums import Lang
from app.projects.schemas import SourceLang


class TranslateIn(BaseModel):
    source_lang: SourceLang | None = None
    target_langs: list[Lang] | None = None


class TermReplace(BaseModel):
    lang: str
    old: str
    new: str
