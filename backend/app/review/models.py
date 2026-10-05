"""Approved versions of a project."""

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, now


class Release(Base):
    """Every approved translation is kept as a release (project history)."""

    __tablename__ = "releases"
    __table_args__ = (CheckConstraint("change_count >= 0", name="ck_releases_change_count"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE", name="fk_releases_project_id"), index=True
    )
    approved_by: Mapped[str]
    editors: Mapped[list[str]] = mapped_column(default=list)
    glossary_version: Mapped[int] = mapped_column(default=0)
    change_count: Mapped[int] = mapped_column(default=0)
    preview: Mapped[dict[str, Any]] = mapped_column(default=dict)  # machine output per segment/lang
    final: Mapped[dict[str, Any]] = mapped_column(default=dict)  # approved text per segment/lang
    warnings: Mapped[list[dict[str, Any]]] = mapped_column(default=list)
    created_at: Mapped[datetime] = mapped_column(default=now)
