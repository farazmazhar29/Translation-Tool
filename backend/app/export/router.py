"""Export of approved translations and Excel layout templates."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.accounts.security import Me, Reviewer, Translator
from app.core.db import DB
from app.core.enums import FINISHED_STATUSES
from app.export import service as exporter
from app.export.models import ExportFile, ExportTemplate
from app.export.schemas import ExcelLayout, ExportFileOut, ExportIn, TemplateIn, TemplateOut
from app.projects.queries import get_project
from app.quality import service as quality
from app.review.models import Release

router = APIRouter(prefix="/api", tags=["Export"])


@router.post("/projects/{pid}/export", response_model=ExportFileOut, summary="Export an approved translation")
def export_project(db: DB, user: Translator, pid: int, body: ExportIn) -> ExportFile:
    p = get_project(db, pid)
    if p.status not in FINISHED_STATUSES:
        raise HTTPException(409, "Export ist erst nach der Freigabe möglich.")
    template = db.get(ExportTemplate, body.template_id) if body.template_id else None
    layout = ExcelLayout.model_validate(template.config) if template else body.config
    config = layout.model_dump() if layout else None
    opts = {"include_report": body.include_report, "include_comments": body.include_comments}
    # the report lists what is still open; accepted findings were looked at and judged fine
    warnings = [w for w in quality.check_project(p, body.lang, db) if not w.accepted] if body.include_report else []
    path = exporter.EXPORTERS[body.format](p, body.lang, body.mode, opts, warnings, config)
    last = db.query(Release).filter(Release.project_id == pid).order_by(Release.id.desc()).first()
    ef = ExportFile(
        project_id=pid,
        release_id=last.id if last else None,
        format=body.format,
        lang=body.lang,
        mode=body.mode,
        filename=exporter.download_name(p, body.lang, body.mode, body.format),
        path=str(path),
        created_by=user.username,
    )
    db.add(ef)
    if body.archive_after:
        p.archived = True  # the same as the archive button: the project stays approved
    db.commit()
    return ef


@router.get("/exports/{eid}/download", response_class=FileResponse)
def download_export(db: DB, _: Me, eid: int) -> FileResponse:
    ef = db.get(ExportFile, eid)
    if ef is None or not Path(ef.path).exists():
        raise HTTPException(404, "Exportdatei nicht gefunden")
    return FileResponse(ef.path, filename=ef.filename)


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
