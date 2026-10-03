from datetime import UTC, datetime
from typing import Any

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # naive UTC, portable across SQLite/Postgres


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    full_name: Mapped[str] = mapped_column(default="")
    password_hash: Mapped[str]
    role: Mapped[str] = mapped_column(default="translator")  # translator | reviewer | admin
    active: Mapped[bool] = mapped_column(default=True)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    customer: Mapped[str] = mapped_column(default="")
    filename: Mapped[str] = mapped_column(default="")
    file_path: Mapped[str] = mapped_column(default="")
    file_type: Mapped[str] = mapped_column(default="")
    source_lang: Mapped[str] = mapped_column(default="auto")
    detected_lang: Mapped[str] = mapped_column(default="")
    target_langs: Mapped[list[str]] = mapped_column(default=list)
    status: Mapped[str] = mapped_column(default="new")  # new | preview_ready | in_review | approved | archived
    archived: Mapped[bool] = mapped_column(default=False)
    job_state: Mapped[str] = mapped_column(default="idle")  # idle | running | done | error
    job_progress: Mapped[int] = mapped_column(default=0)
    job_error: Mapped[str] = mapped_column(Text, default="")
    structure: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_by: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    segments: Mapped[list["Segment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Segment.idx"
    )

    @property
    def source(self) -> str:
        return self.detected_lang if self.source_lang == "auto" else self.source_lang


class Segment(Base):
    __tablename__ = "segments"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    idx: Mapped[int]
    locator: Mapped[dict[str, Any]] = mapped_column(default=dict)
    source_text: Mapped[str] = mapped_column(Text)
    project: Mapped[Project] = relationship(back_populates="segments")
    translations: Mapped[list["Translation"]] = relationship(back_populates="segment", cascade="all, delete-orphan")

    def translation(self, lang: str) -> "Translation | None":
        return next((t for t in self.translations if t.lang == lang), None)


class Translation(Base):
    __tablename__ = "translations"
    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("segments.id"), index=True)
    lang: Mapped[str]
    text: Mapped[str] = mapped_column(Text, default="")
    original_text: Mapped[str] = mapped_column(Text, default="")  # machine output before manual edits
    terms: Mapped[list[dict[str, Any]]] = mapped_column(default=list)  # see schemas.Term
    comment: Mapped[str] = mapped_column(Text, default="")
    edited: Mapped[bool] = mapped_column(default=False)
    edited_by: Mapped[str] = mapped_column(default="")
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    segment: Mapped[Segment] = relationship(back_populates="translations")


class GlossaryEntry(Base):
    __tablename__ = "glossary_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    terms: Mapped[dict[str, str]] = mapped_column(default=dict)  # {"de": "Korpus", "en": "carcass"}
    synonyms: Mapped[dict[str, list[str]]] = mapped_column(default=dict)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(default="technical")  # technical | product
    do_not_translate: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(default="approved")  # draft | approved | rejected
    version: Mapped[int] = mapped_column(default=1)
    updated_by: Mapped[str] = mapped_column(default="")
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)


class GlossaryVersion(Base):
    """Snapshot per change. The row id doubles as the global glossary version."""

    __tablename__ = "glossary_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(index=True)
    entry_version: Mapped[int]
    action: Mapped[str]  # create | update | delete
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    changed_by: Mapped[str] = mapped_column(default="")
    changed_at: Mapped[datetime] = mapped_column(default=now)


class Release(Base):
    """Every approved translation is kept as a release (project history)."""

    __tablename__ = "releases"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    approved_by: Mapped[str]
    editors: Mapped[list[str]] = mapped_column(default=list)
    glossary_version: Mapped[int] = mapped_column(default=0)
    change_count: Mapped[int] = mapped_column(default=0)
    preview: Mapped[dict[str, Any]] = mapped_column(default=dict)  # machine output per segment/lang
    final: Mapped[dict[str, Any]] = mapped_column(default=dict)  # approved text per segment/lang
    warnings: Mapped[list[dict[str, Any]]] = mapped_column(default=list)
    created_at: Mapped[datetime] = mapped_column(default=now)


class ExportFile(Base):
    __tablename__ = "export_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    release_id: Mapped[int] = mapped_column(default=0)
    format: Mapped[str]
    lang: Mapped[str] = mapped_column(default="")
    mode: Mapped[str] = mapped_column(default="")
    filename: Mapped[str]
    path: Mapped[str]
    created_by: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(default=now)


class AppSetting(Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(default=dict)


class ExportTemplate(Base):
    __tablename__ = "export_templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    format: Mapped[str]
    config: Mapped[dict[str, Any]] = mapped_column(default=dict)
