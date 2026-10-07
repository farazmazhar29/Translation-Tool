"""Quality check of a project, and the findings the reviewer accepted."""

from fastapi import APIRouter, HTTPException

from app.accounts.security import Me, Translator
from app.core.db import DB
from app.core.enums import Severity
from app.glossary.service import current_version
from app.projects.queries import editable, get_project
from app.quality import service as quality
from app.quality.schemas import AcceptedIn, QualityOut

router = APIRouter(prefix="/api", tags=["Quality"])


@router.get("/projects/{pid}/quality")
def quality_check(db: DB, _: Me, pid: int, lang: str | None = None) -> QualityOut:
    warnings = quality.check_project(get_project(db, pid), lang, db)
    return QualityOut(
        warnings=warnings,
        errors=sum(w.severity == Severity.ERROR for w in warnings),
        glossary_version=current_version(db),
    )


@router.put("/projects/{pid}/quality/accepted", summary="Accept findings as they are (or reopen them with [])")
def accept_findings(db: DB, _: Translator, pid: int, body: AcceptedIn) -> list[str]:
    """A judgment call (a long translation, a different number of line breaks, an ambiguous term) can be accepted;
    an error (a missing translation, a broken glossary term) cannot, it has to be fixed."""
    p = editable(get_project(db, pid))
    acceptable = {w.key for w in quality.check_project(p, db=db) if w.severity != Severity.ERROR}
    if unknown := set(body.keys) - acceptable:
        raise HTTPException(400, f"Diese Hinweise können nicht akzeptiert werden: {sorted(unknown)[:5]}")
    p.accepted_findings = sorted(set(body.keys))
    db.commit()
    return p.accepted_findings
