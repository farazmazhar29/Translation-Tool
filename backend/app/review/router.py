"""Review workflow: approve, reopen; release history."""

from fastapi import APIRouter, HTTPException

from app.accounts.security import Me, Reviewer, Translator
from app.core.db import DB
from app.core.enums import ProjectStatus
from app.export.models import ExportFile
from app.glossary.service import current_version
from app.projects.models import Project
from app.projects.queries import get_project
from app.projects.schemas import ProjectOut
from app.quality import service as quality
from app.review.models import Release
from app.review.schemas import HistoryOut, ReleaseDetail

router = APIRouter(prefix="/api", tags=["Review"])


@router.post("/projects/{pid}/approve", response_model=ProjectOut, summary="'Übersetzung freigeben'")
def approve(db: DB, user: Reviewer, pid: int) -> Project:
    """Stores the final translation as a release (history). Export is only possible afterwards."""
    p = get_project(db, pid)
    if p.status != ProjectStatus.PREVIEW_READY:
        raise HTTPException(409, "Projekt kann in diesem Status nicht freigegeben werden.")
    missing = [
        s.idx + 1 for s in p.segments for lang in p.targets if not ((t := s.translation(lang)) and t.text.strip())
    ]
    if missing:
        raise HTTPException(400, f"Segment(e) {missing[:10]} haben keine Übersetzung.")
    trs = [t for s in p.segments for t in s.translations]
    db.add(
        Release(
            project_id=p.id,
            approved_by=user.username,
            glossary_version=current_version(db),
            editors=sorted({t.edited_by for t in trs if t.edited_by} | {p.created_by}),
            change_count=sum(t.edited for t in trs),
            preview={str(s.id): {t.lang: t.original_text for t in s.translations} for s in p.segments},
            final={str(s.id): {t.lang: t.text for t in s.translations} for s in p.segments},
            warnings=[w.model_dump() for w in quality.check_project(p)],
        )
    )
    p.status = ProjectStatus.APPROVED
    db.commit()
    return p


@router.post("/projects/{pid}/reopen", response_model=ProjectOut, summary="Reopen a finished project")
def reopen(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = False
    p.status = ProjectStatus.PREVIEW_READY if any(s.translations for s in p.segments) else ProjectStatus.NEW
    db.commit()
    return p


@router.get("/releases/{rid}", summary="Preview and final text of one approved version")
def release_detail(db: DB, _: Me, rid: int) -> ReleaseDetail:
    release = db.get(Release, rid)
    if release is None:
        raise HTTPException(404, "Version nicht gefunden")
    return ReleaseDetail.model_validate(release)


@router.get("/projects/{pid}/history", summary="Releases and exports of a project")
def history(db: DB, _: Me, pid: int) -> HistoryOut:
    p = get_project(db, pid)
    return HistoryOut.model_validate(
        {
            "project": p,
            "releases": db.query(Release).filter(Release.project_id == pid).order_by(Release.id.desc()).all(),
            "exports": db.query(ExportFile).filter(ExportFile.project_id == pid).order_by(ExportFile.id.desc()).all(),
        },
        from_attributes=True,
    )
