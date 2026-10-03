from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import admin, glossary, projects, workflow
from .seed import seed

DESCRIPTION = """
Browser-based AI translation tool for kitchen-industry documents (glossary-aware, human-in-the-loop).

**Workflow:** upload → preview → highlight terms → edit → quality check → approve → export → archive.

Log in via **Authorize** (demo users: `admin/admin123`, `reviewer/reviewer123`, `translator/translator123`).
"""


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Rotpunkt Übersetzungstool", version="0.1.0", description=DESCRIPTION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"]
)
for r in (admin.router, projects.router, workflow.router, glossary.router):
    app.include_router(r)


@app.get("/api/health", tags=["Admin"])
def health() -> dict[str, str]:
    return {"status": "ok", "llm_provider": settings.llm_provider}


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():  # one central server: the built frontend is served next to the API
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = DIST / path
        return FileResponse(file if path and file.is_file() else DIST / "index.html")
