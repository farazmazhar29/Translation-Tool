"""Look up a project or segment and check that it can still be edited (shared by several features)."""

from fastapi import HTTPException

from app.core.db import DB
from app.core.enums import EDITABLE_STATUSES
from app.projects.models import Project, Segment


def get_project(db: DB, pid: int) -> Project:
    p = db.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Projekt nicht gefunden")
    return p


def editable(p: Project) -> Project:
    if p.status not in EDITABLE_STATUSES:
        raise HTTPException(409, "Projekt ist freigegeben/archiviert – bitte zuerst erneut öffnen.")
    return p


def get_segment(db: DB, sid: int) -> Segment:
    s = db.get(Segment, sid)
    if s is None:
        raise HTTPException(404, "Segment nicht gefunden")
    editable(s.project)
    return s
