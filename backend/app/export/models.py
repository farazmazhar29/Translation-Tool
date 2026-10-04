"""Exported files and Excel layout templates."""

from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Choice, now
from app.core.enums import ExportMode, FileFormat


class ExportFile(Base):
    __tablename__ = "export_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    release_id: Mapped[int] = mapped_column(default=0)
    format: Mapped[FileFormat] = mapped_column(Choice(FileFormat))
    lang: Mapped[str] = mapped_column(default="")
    mode: Mapped[ExportMode] = mapped_column(Choice(ExportMode))
    filename: Mapped[str]
    path: Mapped[str]
    created_by: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(default=now)


class ExportTemplate(Base):
    __tablename__ = "export_templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    format: Mapped[FileFormat] = mapped_column(Choice(FileFormat))
    config: Mapped[dict[str, Any]] = mapped_column(default=dict)
