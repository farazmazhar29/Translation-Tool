"""Review, release and history API contract."""

from datetime import datetime
from typing import Any

from app.core.schemas import ORM, Schema
from app.export.schemas import ExportFileOut
from app.projects.schemas import ProjectOut
from app.quality.schemas import QualityWarning


class ReleaseOut(ORM):
    id: int
    approved_by: str
    editors: list[str]
    created_at: datetime
    glossary_version: int
    change_count: int
    warnings: list[QualityWarning]


class ReleaseDetail(ReleaseOut):
    """One approved version: what the machine produced (preview) and what was approved (final), per segment id."""

    preview: dict[str, Any]
    final: dict[str, Any]


class HistoryOut(Schema):
    project: ProjectOut
    releases: list[ReleaseOut]
    exports: list[ExportFileOut]
