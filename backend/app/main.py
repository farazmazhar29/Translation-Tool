import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text, update
from sqlalchemy.exc import SQLAlchemyError

from . import middleware
from .config import settings
from .db import DB, SessionLocal
from .logging_setup import setup_logging
from .migrate import upgrade_to_head
from .models import Project
from .routers import admin, glossary, projects, workflow
from .seed import seed

log = logging.getLogger(__name__)

DESCRIPTION = """
Browser-based AI translation tool for kitchen-industry documents (glossary-aware, human-in-the-loop).

**Workflow:** upload → preview → highlight terms → edit → quality check → approve → export → archive.

Log in via **Authorize** (demo users: `admin/admin123`, `reviewer/reviewer123`, `translator/translator123`).
"""


def recover_interrupted_jobs() -> None:
    """A restart kills background translations; do not leave their projects "running" forever."""
    with SessionLocal() as db:
        result = db.execute(
            update(Project)
            .where(Project.job_state == "running")
            .values(job_state="error", job_error="Der Server wurde neu gestartet – bitte die Übersetzung neu starten.")
        )
        db.commit()
    if result.rowcount:
        log.warning("Marked %d interrupted translation job(s) as failed", result.rowcount)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    setup_logging()
    if settings.auto_migrate:
        upgrade_to_head()
    with SessionLocal() as db:
        seed(db)
    recover_interrupted_jobs()
    yield


app = FastAPI(
    title="Rotpunkt Übersetzungstool",
    version="0.1.0",
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
middleware.install(app)
for r in (admin.router, projects.router, workflow.router, glossary.router):
    app.include_router(r)


@app.get("/api/health", tags=["Admin"], summary="Liveness: the process answers")
def health() -> dict[str, str]:
    return {"status": "ok", "llm_provider": settings.llm_provider}


@app.get("/api/ready", tags=["Admin"], summary="Readiness: the database is reachable")
def ready(db: DB) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Datenbank nicht erreichbar") from None
    return {"status": "ready"}


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():  # one central server: the built frontend is served next to the API
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = (DIST / path).resolve()
        # never serve anything outside the build directory (path traversal)
        return FileResponse(file if path and file.is_file() and file.is_relative_to(DIST) else DIST / "index.html")
