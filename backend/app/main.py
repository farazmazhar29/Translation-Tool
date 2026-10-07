import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text, update
from sqlalchemy.exc import SQLAlchemyError

from app.accounts import router as accounts
from app.core import middleware
from app.core.config import settings
from app.core.db import DB, SessionLocal
from app.core.enums import JobState
from app.core.errors import AppError, ErrorCode, app_error_handler
from app.core.logging_setup import setup_logging
from app.core.migrate import upgrade_to_head
from app.dashboard import router as dashboard
from app.export import router as export
from app.glossary import router as glossary
from app.preferences import router as preferences
from app.projects import router as projects
from app.projects.models import Project
from app.quality import router as quality
from app.review import router as review
from app.seed import seed
from app.translation import router as translation

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
            .where(Project.job_state == JobState.RUNNING)
            .values(
                job_state=JobState.ERROR,
                job_error="The server was restarted. Please start the translation again.",
                job_error_code=ErrorCode.SERVER_RESTARTED,
                job_error_params={},
            )
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


def operation_id(route: APIRoute) -> str:
    """The function name ("get_project") instead of FastAPI's "get_project_api_projects__pid__get": the generated
    frontend client turns it into `getProject`."""
    return route.name


app = FastAPI(
    title="Rotpunkt Translation Tool",
    version="0.1.0",
    description=DESCRIPTION,
    lifespan=lifespan,
    generate_unique_id_function=operation_id,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)
app.add_exception_handler(AppError, app_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
middleware.install(app)
for r in (
    accounts.router,
    preferences.router,
    dashboard.router,
    glossary.router,
    projects.router,
    translation.router,
    quality.router,
    review.router,
    export.router,
):
    app.include_router(r)


@app.get("/api/health", tags=["Admin"], summary="Liveness: the process answers")
def health() -> dict[str, str]:
    return {"status": "ok", "llm_provider": settings.llm_provider}


@app.get("/api/ready", tags=["Admin"], summary="Readiness: the database is reachable")
def ready(db: DB) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise AppError(503, ErrorCode.DATABASE_UNREACHABLE, "Database not reachable") from None
    return {"status": "ready"}


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():  # one central server: the built frontend is served next to the API
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = (DIST / path).resolve()
        # never serve anything outside the build directory (path traversal)
        return FileResponse(file if path and file.is_file() and file.is_relative_to(DIST) else DIST / "index.html")
