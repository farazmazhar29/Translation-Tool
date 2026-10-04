"""Pipeline: segments -> glossary matching -> LLM -> post-verification."""

import logging
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.enums import JobState, ProjectStatus, TermCategory
from app.glossary import service as gl
from app.glossary.schemas import Term
from app.preferences.models import AppSetting
from app.projects.models import Project, Segment, Translation
from app.translation.llm import LLMError, LLMProvider, LLMSegment, get_provider

log = logging.getLogger(__name__)


def runtime_settings(db: Session) -> dict[str, str]:
    row = db.get(AppSetting, "general")
    return {k: str(v) for k, v in (row.value if row else {}).items() if k.startswith("llm_")}


def translate_segments(
    db: Session,
    segments: list[Segment],
    src: str,
    tgt: str,
    provider: LLMProvider,
    progress: Callable[[int], None] | None = None,
) -> None:
    """(Re)write the Translation rows of `segments` for language `tgt`."""
    index = gl.build_index(db, src, tgt)
    for start in range(0, len(segments), settings.batch_size):
        chunk = segments[start : start + settings.batch_size]
        hits = {s.id: gl.match_segment(s.source_text, index) for s in chunk}
        batch = [
            LLMSegment.model_validate(
                {
                    "id": s.id,
                    "text": s.source_text,
                    "glossary": [{"source": h.matched, "target": h.target, "dnt": h.dnt} for h in hits[s.id]],
                }
            )
            for s in chunk
        ]
        results = {r.id: r for r in provider.translate_batch(src, tgt, batch)}
        for s in chunk:
            res = results.get(s.id)
            text = res.translation.strip() if res else ""
            covered = [h.matched.lower() for h in hits[s.id]]
            terms = [h.term().model_copy(update={"ok": bool(text) and h.ok_in(text)}) for h in hits[s.id]]
            terms += [
                Term(
                    source=c,
                    target=c,
                    category=TermCategory.PROTECTED,
                    dnt=True,
                    ok=c in text,
                    description="Artikelnummer / Produktcode – nicht übersetzen",
                )
                for c in gl.find_protected(s.source_text)
                if not any(c.lower() in m for m in covered)
            ]
            terms += [
                Term(**t.model_dump())
                for t in (res.terms if res else [])
                if not any(t.source.lower() in m or m in t.source.lower() for m in covered)
            ]
            tr = s.translation(tgt)
            if tr is None:
                tr = Translation.empty(tgt)
                s.translations.append(tr)
            tr.text = tr.original_text = text
            tr.terms = [t.model_dump() for t in terms]
            tr.edited, tr.edited_by = False, ""
        db.commit()
        if progress:
            progress(start + len(chunk))


def run_project_translation(project_id: int) -> None:
    """Background job: preview translation of every segment into every target language."""
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        if p is None:
            return
        try:
            p.job_state, p.job_progress, p.job_error = JobState.RUNNING, 0, ""
            db.commit()
            rt = runtime_settings(db)
            provider = get_provider(rt.get("llm_provider"), rt.get("llm_model"))
            if not p.source:
                raise LLMError("Ausgangssprache konnte nicht erkannt werden – bitte manuell wählen.")
            targets = p.targets
            total = max(1, len(p.segments) * len(targets))
            for n, tgt in enumerate(targets):

                def progress(done: int, base: int = n * len(p.segments)) -> None:
                    p.job_progress = 100 * (base + done) // total
                    db.commit()

                translate_segments(db, p.segments, p.source, tgt, provider, progress)
            p.status, p.job_state, p.job_progress = ProjectStatus.PREVIEW_READY, JobState.DONE, 100
        except Exception as e:  # shown in the UI
            log.exception("translation failed")
            db.rollback()
            p.job_state, p.job_error = JobState.ERROR, str(e)[:500]
        db.commit()
