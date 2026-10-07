"""Look up a project or segment and check that it can still be edited (shared by several features)."""

from sqlalchemy.orm import selectinload

from app.core.db import DB
from app.core.enums import EDITABLE_STATUSES
from app.core.errors import AppError, ErrorCode
from app.projects.models import Project, Segment


def get_project(db: DB, pid: int) -> Project:
    # Load the segments (and, through the relationship, their translations) in two queries instead of one per segment.
    p = db.get(Project, pid, options=[selectinload(Project.segments)])
    if p is None:
        raise AppError(404, ErrorCode.PROJECT_NOT_FOUND, "Project not found")
    return p


def editable(p: Project) -> Project:
    if p.status not in EDITABLE_STATUSES:
        raise AppError(409, ErrorCode.PROJECT_LOCKED, "The project is approved or archived. Please reopen it first.")
    return p


def get_segment(db: DB, sid: int) -> Segment:
    s = db.get(Segment, sid)
    if s is None:
        raise AppError(404, ErrorCode.SEGMENT_NOT_FOUND, "Segment not found")
    editable(s.project)
    return s
