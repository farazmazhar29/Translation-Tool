"""Projects, their segments and the translation of each segment."""

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, Choice, now, one_of
from app.core.enums import FileFormat, JobState, ProjectStatus


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        one_of("projects", "status", ProjectStatus),
        one_of("projects", "job_state", JobState),
        one_of("projects", "file_type", FileFormat),
        CheckConstraint("job_progress BETWEEN 0 AND 100", name="ck_projects_job_progress"),
        Index("ix_projects_archived_updated_at", "archived", "updated_at"),  # the project list
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    customer: Mapped[str] = mapped_column(default="")
    filename: Mapped[str] = mapped_column(default="")
    file_path: Mapped[str] = mapped_column(default="")
    file_type: Mapped[FileFormat] = mapped_column(Choice(FileFormat))
    source_lang: Mapped[str] = mapped_column(default="auto")
    detected_lang: Mapped[str] = mapped_column(default="")
    target_langs: Mapped[list[str]] = mapped_column(default=list)
    status: Mapped[ProjectStatus] = mapped_column(Choice(ProjectStatus), default=ProjectStatus.NEW)
    archived: Mapped[bool] = mapped_column(default=False)
    job_state: Mapped[JobState] = mapped_column(Choice(JobState), default=JobState.IDLE)
    job_progress: Mapped[int] = mapped_column(default=0)
    job_error: Mapped[str] = mapped_column(Text, default="")
    structure: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # quality findings the reviewer looked at and accepted as they are (`QualityWarning.key`)
    accepted_findings: Mapped[list[str]] = mapped_column(default=list)
    created_by: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    segments: Mapped[list["Segment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Segment.idx"
    )

    @property
    def source(self) -> str:
        return self.detected_lang if self.source_lang == "auto" else self.source_lang

    @property
    def targets(self) -> list[str]:
        """Languages that are actually translated: a source-language "target" would make no sense."""
        return [t for t in self.target_langs if t != self.source]


class Segment(Base):
    __tablename__ = "segments"
    __table_args__ = (
        UniqueConstraint("project_id", "idx", name="uq_segments_project_id_idx"),
        CheckConstraint("idx >= 0", name="ck_segments_idx"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE", name="fk_segments_project_id")
    )
    idx: Mapped[int]
    locator: Mapped[dict[str, Any]] = mapped_column(default=dict)
    source_text: Mapped[str] = mapped_column(Text)
    project: Mapped[Project] = relationship(back_populates="segments")
    translations: Mapped[list["Translation"]] = relationship(
        back_populates="segment",
        cascade="all, delete-orphan",
        lazy="selectin",  # one query for all segments, not one each
    )

    def translation(self, lang: str) -> "Translation | None":
        return next((t for t in self.translations if t.lang == lang), None)


class Translation(Base):
    __tablename__ = "translations"
    __table_args__ = (UniqueConstraint("segment_id", "lang", name="uq_translations_segment_id_lang"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(
        ForeignKey("segments.id", ondelete="CASCADE", name="fk_translations_segment_id")
    )
    lang: Mapped[str]
    text: Mapped[str] = mapped_column(Text, default="")
    original_text: Mapped[str] = mapped_column(Text, default="")  # machine output before manual edits
    terms: Mapped[list[dict[str, Any]]] = mapped_column(default=list)  # see schemas.Term
    comment: Mapped[str] = mapped_column(Text, default="")
    edited: Mapped[bool] = mapped_column(default=False)
    edited_by: Mapped[str] = mapped_column(default="")
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    segment: Mapped[Segment] = relationship(back_populates="translations")

    @classmethod
    def empty(cls, lang: str) -> "Translation":
        """Column defaults only apply on INSERT; a new object must be usable before it is flushed."""
        return cls(lang=lang, text="", original_text="", terms=[], comment="", edited=False, edited_by="")
