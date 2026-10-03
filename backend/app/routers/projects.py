import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_

from ..auth import Admin, Me, Translator
from ..config import settings
from ..db import DB
from ..models import ExportFile, Project, Release, Segment, Translation
from ..schemas import ProjectDetail, ProjectOut, ProjectPatch
from ..services import parsing
from ..services.translation import LANGS, detect_language

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def get_project(db: DB, pid: int) -> Project:
    p = db.get(Project, pid)
    if p is None:
        raise HTTPException(404, "Projekt nicht gefunden")
    return p


@router.get("", response_model=list[ProjectOut], summary="Search and filter projects")
def list_projects(
    db: DB,
    _: Me,
    q: str = "",
    status: str = "",
    archived: str = "no",
    lang: str = "",
    customer: str = "",
    editor: str = "",
    term: str = "",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Project]:
    """`archived`: no | only | all. `term` searches inside original and translated text."""
    query = db.query(Project)
    if archived != "all":
        query = query.filter(Project.archived.is_(archived == "only"))
    if q:
        query = query.filter(or_(*(c.ilike(f"%{q}%") for c in (Project.name, Project.filename, Project.customer))))
    if status:
        query = query.filter(Project.status == status)
    if customer:
        query = query.filter(Project.customer.ilike(f"%{customer}%"))
    if date_from:
        query = query.filter(Project.updated_at >= date_from)
    if date_to:
        query = query.filter(Project.updated_at < date_to + timedelta(days=1))
    if editor:
        ids = {
            i
            for (i,) in db.query(Segment.project_id)
            .join(Translation)
            .filter(Translation.edited_by.ilike(f"%{editor}%"))
        }
        ids |= {i for (i,) in db.query(Release.project_id).filter(Release.approved_by.ilike(f"%{editor}%"))}
        query = query.filter(or_(Project.created_by.ilike(f"%{editor}%"), Project.id.in_(ids)))
    if term:
        ids = {i for (i,) in db.query(Segment.project_id).filter(Segment.source_text.ilike(f"%{term}%"))}
        ids |= {
            i for (i,) in db.query(Segment.project_id).join(Translation).filter(Translation.text.ilike(f"%{term}%"))
        }
        query = query.filter(Project.id.in_(ids))
    found = query.order_by(Project.updated_at.desc()).all()
    return [p for p in found if not lang or lang in (*p.target_langs, p.source_lang, p.detected_lang)]


@router.post("", response_model=ProjectOut, summary="Upload a file – the project is created automatically")
def create_project(
    db: DB,
    user: Translator,
    file: Annotated[UploadFile, File()],
    name: Annotated[str, Form()] = "",
    customer: Annotated[str, Form()] = "",
    source_lang: Annotated[str, Form()] = "auto",
    target_langs: Annotated[str, Form(description="comma separated, e.g. 'en,de'")] = "",
) -> Project:
    filename = file.filename or "upload"
    stored = settings.data_dir / "uploads" / f"{uuid.uuid4().hex}{Path(filename).suffix.lower()}"
    try:
        ftype = parsing.file_type(filename)
        with stored.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        parts, structure = parsing.parse_file(stored, ftype)
    except ValueError as e:
        stored.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from None
    except Exception:
        stored.unlink(missing_ok=True)
        raise HTTPException(400, "Datei konnte nicht gelesen werden (beschädigt oder passwortgeschützt?).") from None
    if not parts:
        stored.unlink(missing_ok=True)
        raise HTTPException(400, "In der Datei wurde kein übersetzbarer Text gefunden.")
    detected = detect_language([p.text for p in parts])
    targets = [t for t in target_langs.split(",") if t in LANGS] or [next(x for x in LANGS if x != detected)]
    project = Project(
        name=name.strip() or Path(filename).stem,
        customer=customer.strip(),
        filename=filename,
        file_path=str(stored),
        file_type=ftype,
        source_lang=source_lang,
        detected_lang=detected,
        target_langs=targets,
        structure=structure,
        created_by=user.username,
        segments=[Segment(idx=i, locator=p.locator, source_text=p.text) for i, p in enumerate(parts)],
    )
    db.add(project)
    db.commit()
    return project


@router.get("/{pid}", response_model=ProjectDetail)
def project_detail(db: DB, _: Me, pid: int) -> Project:
    return get_project(db, pid)


@router.patch("/{pid}", response_model=ProjectOut)
def patch_project(db: DB, _: Translator, pid: int, body: ProjectPatch) -> Project:
    p = get_project(db, pid)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(p, key, value)
    db.commit()
    return p


@router.post("/{pid}/archive", response_model=ProjectOut)
def archive(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = True
    db.commit()
    return p


@router.post("/{pid}/unarchive", response_model=ProjectOut)
def unarchive(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = False
    db.commit()
    return p


@router.post("/{pid}/copy", response_model=ProjectOut, summary="Copy a project (optionally with translations)")
def copy_project(db: DB, user: Translator, pid: int, with_translations: bool = False) -> Project:
    p = get_project(db, pid)
    new_file = settings.data_dir / "uploads" / f"{uuid.uuid4().hex}{Path(p.file_path).suffix}"
    shutil.copy(p.file_path, new_file)
    copied = with_translations and p.status != "new"
    c = Project(
        name=f"{p.name} (Kopie)",
        customer=p.customer,
        filename=p.filename,
        file_path=str(new_file),
        file_type=p.file_type,
        source_lang=p.source_lang,
        detected_lang=p.detected_lang,
        target_langs=list(p.target_langs),
        structure=p.structure,
        created_by=user.username,
        status="preview_ready" if copied else "new",
        segments=[
            Segment(
                idx=s.idx,
                locator=s.locator,
                source_text=s.source_text,
                translations=[
                    Translation(
                        lang=t.lang, text=t.text, original_text=t.original_text, terms=t.terms, comment=t.comment
                    )
                    for t in s.translations
                    if with_translations
                ],
            )
            for s in p.segments
        ],
    )
    db.add(c)
    db.commit()
    return c


@router.delete("/{pid}", summary="Delete a project (admin)")
def delete_project(db: DB, _: Admin, pid: int) -> dict[str, bool]:
    p = get_project(db, pid)
    db.query(Release).filter(Release.project_id == pid).delete()
    db.query(ExportFile).filter(ExportFile.project_id == pid).delete()
    Path(p.file_path).unlink(missing_ok=True)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/{pid}/original", response_class=FileResponse, summary="Download the original file")
def download_original(db: DB, _: Me, pid: int) -> FileResponse:
    p = get_project(db, pid)
    return FileResponse(p.file_path, filename=p.filename)
