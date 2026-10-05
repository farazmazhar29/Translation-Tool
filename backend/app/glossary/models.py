"""Glossary entries and their change history."""

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Choice, now, one_of
from app.core.enums import EntryCategory, GlossaryAction, GlossaryStatus


class GlossaryEntry(Base):
    __tablename__ = "glossary_entries"
    __table_args__ = (
        one_of("glossary_entries", "category", EntryCategory),
        one_of("glossary_entries", "status", GlossaryStatus),
        CheckConstraint("version >= 1", name="ck_glossary_entries_version"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    terms: Mapped[dict[str, str]] = mapped_column(default=dict)  # {"de": "Korpus", "en": "carcass"}
    synonyms: Mapped[dict[str, list[str]]] = mapped_column(default=dict)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[EntryCategory] = mapped_column(Choice(EntryCategory), default=EntryCategory.TECHNICAL)
    do_not_translate: Mapped[bool] = mapped_column(default=False)
    status: Mapped[GlossaryStatus] = mapped_column(Choice(GlossaryStatus), default=GlossaryStatus.APPROVED)
    version: Mapped[int] = mapped_column(default=1)
    updated_by: Mapped[str] = mapped_column(default="")
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)


class GlossaryVersion(Base):
    """Snapshot per change. The row id doubles as the global glossary version."""

    __tablename__ = "glossary_versions"
    __table_args__ = (one_of("glossary_versions", "action", GlossaryAction),)
    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(index=True)
    entry_version: Mapped[int]
    action: Mapped[GlossaryAction] = mapped_column(Choice(GlossaryAction))
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    changed_by: Mapped[str] = mapped_column(default="")
    changed_at: Mapped[datetime] = mapped_column(default=now)
