"""Translation workflow: preview -> edit -> quality check -> review -> approval -> export -> history."""

import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from ..auth import Me, Reviewer, Translator
from ..db import DB
from ..models import ExportFile, ExportTemplate, GlossaryVersion, Project, Release, Segment, Translation
from ..schemas import (
    ExcelLayout,
    ExportFileOut,
    ExportIn,
    HistoryOut,
    JobStatus,
    ProjectOut,
    QualityOut,
    ReleaseDetail,
    SegmentEdit,
    SegmentOut,
    TemplateIn,
    TemplateOut,
    TermReplace,
    TranslateIn,
)
from ..services import export as exporter
from ..services import quality
from ..services.llm import LLMError, get_provider
from ..services.translation import run_project_translation, runtime_settings, translate_segments
from .projects import get_project

router = APIRouter(prefix="/api", tags=["Workflow"])
EDITABLE = ("new", "preview_ready", "in_review")


def editable(p: Project) -> Project:
    if p.status not in EDITABLE:
        raise HTTPException(409, "Projekt ist freigegeben/archiviert – bitte zuerst erneut öffnen.")
    return p


def get_segment(db: DB, sid: int) -> Segment:
    s = db.get(Segment, sid)
    if s is None:
        raise HTTPException(404, "Segment nicht gefunden")
    editable(s.project)
    return s


def glossary_version(db: DB) -> int:
    last = db.query(GlossaryVersion).order_by(GlossaryVersion.id.desc()).first()
    return last.id if last else 0


# translate + edit
@router.post("/projects/{pid}/translate", response_model=ProjectOut, summary="Start the PREVIEW translation")
def start_translation(db: DB, _: Translator, pid: int, bg: BackgroundTasks, body: TranslateIn | None = None) -> Project:
    """Only creates a preview. The final translation is produced on approval."""
    p = editable(get_project(db, pid))
    if p.job_state == "running":
        raise HTTPException(409, "Übersetzung läuft bereits.")
    if body and body.source_lang:
        p.source_lang = body.source_lang
    if body and body.target_langs is not None:
        p.target_langs = list(body.target_langs)
    if not p.target_langs:
        raise HTTPException(400, "Bitte mindestens eine Zielsprache wählen.")
    p.job_state, p.job_progress, p.job_error = "running", 0, ""
    db.commit()
    bg.add_task(run_project_translation, pid)
    return p


@router.get("/projects/{pid}/status", response_model=JobStatus)
def job_status(db: DB, _: Me, pid: int) -> Project:
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
            {**t, "ok": t["target"].lower() in body.text.lower()} if t["category"] in ("glossary", "protected") else t
            for t in tr.terms
        ]  # re-verify glossary compliance after a manual edit
    if body.comment is not None:
        tr.comment = body.comment
    db.commit()
    return seg


@router.post("/segments/{sid}/{lang}/retranslate", response_model=SegmentOut, summary="Regenerate one segment")
def retranslate(db: DB, _: Translator, sid: int, lang: str) -> Segment:
    seg = get_segment(db, sid)
    try:
        rt = runtime_settings(db)
        translate_segments(
            db, [seg], seg.project.source, lang, get_provider(rt.get("llm_provider"), rt.get("llm_model"))
        )
    except LLMError as e:
        raise HTTPException(502, str(e)) from None
    return seg


@router.post("/projects/{pid}/replace-term", summary="Replace a translated term in the whole project")
def replace_term(db: DB, user: Translator, pid: int, body: TermReplace) -> dict[str, int]:
    p = editable(get_project(db, pid))
    pat = re.compile(rf"(?<!\w){re.escape(body.old)}(?!\w)", re.I)
    changed = 0
    for seg in p.segments:
        tr = seg.translation(body.lang)
        if tr and pat.search(tr.text):
            tr.text, tr.edited, tr.edited_by = pat.sub(body.new, tr.text), True, user.username
            tr.terms = [
                {**t, "target": body.new, "ok": True} if t["target"].lower() == body.old.lower() else t
                for t in tr.terms
            ]
            changed += 1
    db.commit()
    return {"replaced_in_segments": changed}


# quality + approval
@router.get("/projects/{pid}/quality")
def quality_check(db: DB, _: Me, pid: int, lang: str | None = None) -> QualityOut:
    warnings = quality.check_project(get_project(db, pid), lang)
    return QualityOut(
        warnings=warnings, errors=sum(w.severity == "error" for w in warnings), glossary_version=glossary_version(db)
    )


@router.post("/projects/{pid}/submit-review", response_model=ProjectOut, summary="Send to a reviewer")
def submit_review(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    if p.status != "preview_ready":
        raise HTTPException(409, "Erst eine Vorschau erzeugen.")
    p.status = "in_review"
    db.commit()
    return p


@router.post("/projects/{pid}/reject", response_model=ProjectOut, summary="Send back to the translator")
def reject(db: DB, _: Reviewer, pid: int) -> Project:
    p = get_project(db, pid)
    if p.status != "in_review":
        raise HTTPException(409, "Projekt ist nicht in Prüfung.")
    p.status = "preview_ready"
    db.commit()
    return p


@router.post("/projects/{pid}/approve", response_model=ProjectOut, summary="'Übersetzung freigeben'")
def approve(db: DB, user: Reviewer, pid: int) -> Project:
    """Stores the final translation as a release (history). Export is only possible afterwards."""
    p = get_project(db, pid)
    if p.status not in ("preview_ready", "in_review"):
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
            glossary_version=glossary_version(db),
            editors=sorted({t.edited_by for t in trs if t.edited_by} | {p.created_by}),
            change_count=sum(t.edited for t in trs),
            preview={str(s.id): {t.lang: t.original_text for t in s.translations} for s in p.segments},
            final={str(s.id): {t.lang: t.text for t in s.translations} for s in p.segments},
            warnings=[w.model_dump() for w in quality.check_project(p)],
        )
    )
    p.status = "approved"
    db.commit()
    return p


@router.post("/projects/{pid}/reopen", response_model=ProjectOut, summary="Reopen a finished project")
def reopen(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = False
    p.status = "preview_ready" if any(s.translations for s in p.segments) else "new"
    db.commit()
    return p


# export + history
@router.post("/projects/{pid}/export", response_model=ExportFileOut, summary="Export an approved translation")
def export_project(db: DB, user: Translator, pid: int, body: ExportIn) -> ExportFile:
    p = get_project(db, pid)
    if p.status not in ("approved", "archived"):
        raise HTTPException(409, "Export ist erst nach der Freigabe möglich.")
    template = db.get(ExportTemplate, body.template_id) if body.template_id else None
    layout = ExcelLayout.model_validate(template.config) if template else body.config
    config = layout.model_dump() if layout else None
    opts = {"include_report": body.include_report, "include_comments": body.include_comments}
    warnings = quality.check_project(p, body.lang) if body.include_report else []
    path = exporter.EXPORTERS[body.format](p, body.lang, body.mode, opts, warnings, config)
    last = db.query(Release).filter(Release.project_id == pid).order_by(Release.id.desc()).first()
    ef = ExportFile(
        project_id=pid,
        release_id=last.id if last else 0,
        format=body.format,
        lang=body.lang,
        mode=body.mode,
        filename=exporter.download_name(p, body.lang, body.mode, body.format),
        path=str(path),
        created_by=user.username,
    )
    db.add(ef)
    if body.archive_after:
        p.archived, p.status = True, "archived"
    db.commit()
    return ef


@router.get("/exports/{eid}/download", response_class=FileResponse)
def download_export(db: DB, _: Me, eid: int) -> FileResponse:
    ef = db.get(ExportFile, eid)
    if ef is None or not Path(ef.path).exists():
        raise HTTPException(404, "Exportdatei nicht gefunden")
    return FileResponse(ef.path, filename=ef.filename)


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


# export templates
@router.get("/export-templates", response_model=list[TemplateOut], tags=["Export templates"])
def list_templates(db: DB, _: Me) -> list[ExportTemplate]:
    return db.query(ExportTemplate).all()


@router.post("/export-templates", response_model=TemplateOut, tags=["Export templates"])
def create_template(db: DB, _: Translator, body: TemplateIn) -> ExportTemplate:
    t = ExportTemplate(name=body.name, format=body.format, config=body.config.model_dump())
    db.add(t)
    db.commit()
    return t


@router.delete("/export-templates/{tid}", tags=["Export templates"])
def delete_template(db: DB, _: Reviewer, tid: int) -> dict[str, bool]:
    if t := db.get(ExportTemplate, tid):
        db.delete(t)
        db.commit()
    return {"ok": True}
