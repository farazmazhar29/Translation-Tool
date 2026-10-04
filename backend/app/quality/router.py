"""Quality check of a project."""

from fastapi import APIRouter

from app.accounts.security import Me
from app.core.db import DB
from app.core.enums import Severity
from app.glossary.service import current_version
from app.projects.queries import get_project
from app.quality import service as quality
from app.quality.schemas import QualityOut

router = APIRouter(prefix="/api", tags=["Quality"])


@router.get("/projects/{pid}/quality")
def quality_check(db: DB, _: Me, pid: int, lang: str | None = None) -> QualityOut:
    warnings = quality.check_project(get_project(db, pid), lang)
    return QualityOut(
        warnings=warnings,
        errors=sum(w.severity == Severity.ERROR for w in warnings),
        glossary_version=current_version(db),
    )
