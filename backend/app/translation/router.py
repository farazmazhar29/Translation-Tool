"""Start a translation, edit segments, replace terms."""

import re

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.accounts.security import Me, Translator
from app.core.db import DB
from app.core.enums import JobState, TermCategory
from app.projects.language import target_languages
from app.projects.models import Project, Segment, Translation
from app.projects.queries import editable, get_project, get_segment
from app.projects.schemas import JobStatus, ProjectOut, SegmentEdit, SegmentOut
from app.translation.llm import LLMError
from app.translation.pipeline import chosen_provider, run_project_translation, translate_segments
from app.translation.schemas import TermReplace, TranslateIn

router = APIRouter(prefix="/api", tags=["Translation"])


@router.post("/projects/{pid}/translate", response_model=ProjectOut, summary="Start the PREVIEW translation")
def start_translation(db: DB, _: Translator, pid: int, bg: BackgroundTasks, body: TranslateIn | None = None) -> Project:
    """Only creates a preview. The final translation is produced on approval."""
    p = editable(get_project(db, pid))
    if p.job_state == JobState.RUNNING:
        raise HTTPException(409, "Übersetzung läuft bereits.")
    if body and body.source_lang:
        p.source_lang = body.source_lang
    p.target_langs = target_languages(p.source)
    if not p.target_langs:
        raise HTTPException(400, "Die Ausgangssprache wurde nicht erkannt. Bitte Deutsch oder Englisch wählen.")
    p.job_state, p.job_progress, p.job_error = JobState.RUNNING, 0, ""
    db.commit()
    bg.add_task(run_project_translation, pid)
    return p


@router.get("/projects/{pid}/status", response_model=JobStatus)
def get_job_status(db: DB, _: Me, pid: int) -> Project:
    return get_project(db, pid)


@router.put("/segments/{sid}/{lang}", response_model=SegmentOut, summary="Edit translation text or comment")
def edit_segment(db: DB, user: Translator, sid: int, lang: str, body: SegmentEdit) -> Segment:
    seg = get_segment(db, sid)
    tr = seg.translation(lang)
    if tr is None:
        tr = Translation.empty(lang)
        seg.translations.append(tr)
    if body.text is not None and body.text != tr.text:
        tr.text, tr.edited, tr.edited_by = body.text, body.text != tr.original_text, user.username
        tr.terms = [
            {**t, "ok": t["target"].lower() in body.text.lower()}
            if t["category"] in (TermCategory.GLOSSARY, TermCategory.PROTECTED)
            else t
            for t in tr.terms
        ]  # re-verify glossary compliance after a manual edit
    if body.comment is not None:
        tr.comment = body.comment
    db.commit()
    return seg


@router.post("/segments/{sid}/{lang}/retranslate", response_model=SegmentOut, summary="Regenerate one segment")
def retranslate_segment(db: DB, _: Translator, sid: int, lang: str) -> Segment:
    seg = get_segment(db, sid)
    try:
        translate_segments(db, [seg], seg.project.source, lang, chosen_provider(db))
    except LLMError as e:
        raise HTTPException(502, str(e)) from None
    return seg


@router.post("/projects/{pid}/replace-term", summary="Replace a translated term in the whole project")
def replace_term(db: DB, user: Translator, pid: int, body: TermReplace) -> dict[str, int]:
    p = editable(get_project(db, pid))
    pat = re.compile(rf"(?<!\w){re.escape(body.old)}(?!\w)", re.I)

    def keep_case(m: re.Match[str]) -> str:  # "Wall units" at the start of a sentence -> "Wall cabinets"
        return body.new[:1].upper() + body.new[1:] if m.group(0)[:1].isupper() else body.new

    changed = 0
    for seg in p.segments:
        tr = seg.translation(body.lang)
        if tr and pat.search(tr.text):
            tr.text, tr.edited, tr.edited_by = pat.sub(keep_case, tr.text), True, user.username
            tr.terms = [
                {**t, "target": body.new, "ok": True} if t["target"].lower() == body.old.lower() else t
                for t in tr.terms
            ]
            changed += 1
    db.commit()
    return {"replaced_in_segments": changed}
