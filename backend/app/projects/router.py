"""Projects: upload, search, copy, archive, delete."""

import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_

from app.accounts.security import Admin, Me, Translator
from app.core.config import settings
from app.core.db import DB
from app.core.enums import AUTO, ArchiveFilter, FileFormat, Lang, ProjectStatus
from app.core.errors import AppError, CodedError, ErrorCode
from app.export.models import ExportFile
from app.projects import parsing
from app.projects.language import detect_language, target_languages
from app.projects.models import Project, Segment, Translation
from app.projects.queries import get_project
from app.projects.schemas import ProjectDetail, ProjectOut, ProjectPatch, SheetOut
from app.review.models import Release

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def save_upload(file: UploadFile, dest: Path) -> None:
    """Stream the upload to disk and refuse files above MAX_UPLOAD_MB (413) without reading them completely."""
    limit = settings.max_upload_mb * 1024 * 1024
    written = 0
    with dest.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                raise AppError(
                    413,
                    ErrorCode.FILE_TOO_LARGE,
                    f"The file is too large (at most {settings.max_upload_mb} MB)",
                    {"max_mb": settings.max_upload_mb},
                )
            out.write(chunk)


@router.get("", response_model=list[ProjectOut], summary="Search and filter projects")
def list_projects(
    db: DB,
    _: Me,
    q: str = "",
    status: ProjectStatus | None = None,
    archived: ArchiveFilter = ArchiveFilter.NO,
    lang: str = "",
    customer: str = "",
    editor: str = "",
    term: str = "",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
) -> list[Project]:
    """`term` searches inside original and translated text."""
    query = db.query(Project)
    if archived != ArchiveFilter.ALL:
        query = query.filter(Project.archived.is_(archived == ArchiveFilter.ONLY))
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
    return [p for p in found if not lang or lang in (*p.target_langs, p.source_lang, p.detected_lang)][:limit]


@router.post("", response_model=ProjectOut, summary="Upload a file – the project is created automatically")
def create_project(
    db: DB,
    user: Translator,
    file: Annotated[UploadFile, File()],
    name: Annotated[str, Form()] = "",
    customer: Annotated[str, Form()] = "",
    source_lang: Annotated[str, Form(description="'auto', 'de' or 'en'; the target is always the other one")] = AUTO,
) -> Project:
    filename = Path(file.filename or "upload").name[:255]  # display name only; the stored file gets a random name
    if source_lang != AUTO and source_lang not in list(Lang):
        raise AppError(400, ErrorCode.INVALID_SOURCE_LANG, "Invalid source language")
    stored = settings.data_dir / "uploads" / f"{uuid.uuid4().hex}{Path(filename).suffix.lower()}"
    try:
        ftype = parsing.file_type(filename)
        save_upload(file, stored)
        parsing.check_signature(stored, ftype)
        parts, structure = parsing.parse_file(stored, ftype)
    except HTTPException:
        stored.unlink(missing_ok=True)
        raise
    except CodedError as e:
        stored.unlink(missing_ok=True)
        raise e.http(400) from None
    except Exception:
        stored.unlink(missing_ok=True)
        raise AppError(
            400, ErrorCode.FILE_UNREADABLE, "The file could not be read (damaged or password protected?)"
        ) from None
    if not parts:
        stored.unlink(missing_ok=True)
        raise AppError(400, ErrorCode.NO_TEXT, "No translatable text was found in the file")
    detected = detect_language([p.text for p in parts])
    project = Project(
        name=(name.strip() or Path(filename).stem)[:200],
        customer=customer.strip()[:200],
        filename=filename,
        file_path=str(stored),
        file_type=ftype,
        source_lang=source_lang,
        detected_lang=detected,
        target_langs=target_languages(detected if source_lang == AUTO else source_lang),
        structure=structure,
        created_by=user.username,
        segments=[Segment(idx=i, locator=p.locator, source_text=p.text) for i, p in enumerate(parts)],
    )
    db.add(project)
    db.commit()
    return project


@router.get("/{pid}", response_model=ProjectDetail)
def get_project_detail(db: DB, _: Me, pid: int) -> Project:
    return get_project(db, pid)


@router.patch("/{pid}", response_model=ProjectOut)
def patch_project(db: DB, _: Translator, pid: int, body: ProjectPatch) -> Project:
    p = get_project(db, pid)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(p, key, value)
    p.target_langs = target_languages(p.source)  # follows a changed source language
    db.commit()
    return p


@router.post("/{pid}/archive", response_model=ProjectOut)
def archive_project(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = True
    db.commit()
    return p


@router.post("/{pid}/unarchive", response_model=ProjectOut)
def unarchive_project(db: DB, _: Translator, pid: int) -> Project:
    p = get_project(db, pid)
    p.archived = False
    db.commit()
    return p


@router.post("/{pid}/copy", response_model=ProjectOut, summary="Copy a project (optionally with translations)")
def copy_project(db: DB, user: Translator, pid: int, with_translations: bool = False) -> Project:
    p = get_project(db, pid)
    new_file = settings.data_dir / "uploads" / f"{uuid.uuid4().hex}{Path(p.file_path).suffix}"
    shutil.copy(p.file_path, new_file)
    copied = with_translations and p.status != ProjectStatus.NEW
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
        status=ProjectStatus.PREVIEW_READY if copied else ProjectStatus.NEW,
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
    for export_file in db.query(ExportFile).filter(ExportFile.project_id == pid):
        Path(export_file.path).unlink(missing_ok=True)
        db.delete(export_file)
    Path(p.file_path).unlink(missing_ok=True)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/{pid}/original", response_class=FileResponse, summary="Download the original file")
def download_original(db: DB, _: Me, pid: int) -> FileResponse:
    p = get_project(db, pid)
    return FileResponse(p.file_path, filename=p.filename)


@router.get("/{pid}/cells", summary="All non-empty cells of an Excel project, for the table view")
def get_sheet_cells(db: DB, _: Me, pid: int) -> list[SheetOut]:
    p = get_project(db, pid)
    if p.file_type != FileFormat.XLSX:
        raise AppError(400, ErrorCode.NOT_A_SHEET, "Only Excel projects have sheets")
    return [SheetOut.model_validate(sheet) for sheet in parsing.read_cells(Path(p.file_path))]
