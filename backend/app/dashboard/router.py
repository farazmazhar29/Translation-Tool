"""Overview numbers for the start page."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func

from app.accounts.security import Me
from app.core.db import DB
from app.core.enums import FINISHED_STATUSES, ProjectStatus
from app.dashboard.schemas import DashboardOut
from app.glossary.models import GlossaryEntry
from app.projects.models import Project, Segment, Translation
from app.review.models import Release

router = APIRouter(prefix="/api")


@router.get("/dashboard", tags=["Dashboard"])
def get_dashboard(db: DB, _: Me) -> DashboardOut:
    projects = db.query(Project).all()
    today = datetime.now(UTC).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    status = Counter(p.status for p in projects if not p.archived)
    translations = db.query(Translation).all()
    usage = Counter(t["glossary_id"] for tr in translations for t in tr.terms if t.get("glossary_id"))
    entries = {e.id: e for e in db.query(GlossaryEntry).filter(GlossaryEntry.id.in_(usage.keys()))}
    per_day = {(today - timedelta(days=i)).date().isoformat(): 0 for i in range(13, -1, -1)}
    for (created,) in db.query(Release.created_at):
        if (day := created.date().isoformat()) in per_day:
            per_day[day] += 1
    return DashboardOut.model_validate(
        {
            "open": status[ProjectStatus.NEW] + status[ProjectStatus.PREVIEW_READY],
            "in_review": status[ProjectStatus.PREVIEW_READY],  # a finished preview is waiting for the reviewer
            "approved": sum(p.status in FINISHED_STATUSES for p in projects),  # archived ones too: still approved
            "edited_today": sum(p.updated_at >= today for p in projects),
            "recent": sorted(projects, key=lambda p: p.updated_at, reverse=True)[:6],
            "top_terms": [
                {"id": i, "term": " → ".join(entries[i].terms.values()), "count": n}
                for i, n in usage.most_common(8)
                if i in entries
            ],
            "stats": {
                "projects_total": len(projects),
                "segments": db.query(func.count(Segment.id)).scalar(),
                "translations": len(translations),
                "manual_edits": sum(t.edited for t in translations),
                "glossary_entries": db.query(func.count(GlossaryEntry.id)).scalar(),
                "by_language": dict(Counter(t.lang for t in translations)),
                "releases_per_day": per_day,
            },
        },
        from_attributes=True,
    )
