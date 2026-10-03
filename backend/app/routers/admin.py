from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func

from ..auth import Admin, Me, create_token, hash_password, verify_password
from ..config import settings
from ..db import DB
from ..models import AppSetting, GlossaryEntry, Project, Release, Segment, Translation, User
from ..schemas import DashboardOut, LoginOut, SettingsOut, UserIn, UserOut

router = APIRouter(prefix="/api", tags=["Admin"])

DEFAULTS: dict[str, Any] = {
    "llm_provider": settings.llm_provider,
    "llm_model": settings.gemini_model,
    "default_source_lang": "auto",
    "default_target_langs": ["en"],
    "default_export_format": "docx",
    "default_export_mode": "translation",
    "colors": {
        "technical": "#3b82f6",
        "glossary": "#22c55e",
        "ambiguous": "#f59e0b",
        "unknown": "#ef4444",
        "protected": "#a855f7",
    },
}


@router.post("/auth/login", response_model=LoginOut, tags=["Auth"])
def login(db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> LoginOut:
    u = db.query(User).filter(User.username == form.username, User.active).first()
    if u is None or not verify_password(form.password, u.password_hash):
        raise HTTPException(401, "Benutzername oder Passwort falsch")
    return LoginOut(access_token=create_token(u), user=UserOut.model_validate(u))


@router.get("/auth/me", response_model=UserOut, tags=["Auth"])
def me(user: Me) -> User:
    return user


# ---------------------------------------------------------------- users (admin)
@router.get("/users", response_model=list[UserOut], tags=["Users"])
def list_users(db: DB, _: Admin) -> list[User]:
    return db.query(User).order_by(User.id).all()


@router.get("/users/names", tags=["Users"], summary="Usernames (for the editor filter)")
def user_names(db: DB, _: Me) -> list[str]:
    return [u.username for u in db.query(User)]


@router.post("/users", response_model=UserOut, tags=["Users"])
def create_user(db: DB, _: Admin, body: UserIn) -> User:
    if len(body.password) < 6:
        raise HTTPException(400, "Passwort muss mindestens 6 Zeichen haben")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, "Benutzername existiert bereits")
    u = User(
        username=body.username,
        full_name=body.full_name,
        role=body.role,
        active=body.active,
        password_hash=hash_password(body.password),
    )
    db.add(u)
    db.commit()
    return u


@router.put("/users/{uid}", response_model=UserOut, tags=["Users"])
def update_user(db: DB, admin: Admin, uid: int, body: UserIn) -> User:
    u = db.get(User, uid)
    if u is None:
        raise HTTPException(404, "Benutzer nicht gefunden")
    if u.id == admin.id and (body.role != "admin" or not body.active):
        raise HTTPException(400, "Die eigene Admin-Rolle kann nicht entfernt werden")
    u.full_name, u.role, u.active = body.full_name, body.role, body.active
    if body.password:
        u.password_hash = hash_password(body.password)
    db.commit()
    return u


# ---------------------------------------------------------------- settings
def read_settings(db: DB) -> SettingsOut:
    row = db.get(AppSetting, "general")
    return SettingsOut.model_validate(
        {**DEFAULTS, **(row.value if row else {}), "gemini_key_configured": bool(settings.gemini_api_key)}
    )


@router.get("/settings", response_model=SettingsOut, tags=["Settings"])
def get_settings(db: DB, _: Me) -> SettingsOut:
    return read_settings(db)


@router.put("/settings", response_model=SettingsOut, tags=["Settings"])
def put_settings(db: DB, _: Admin, body: dict[str, Any]) -> SettingsOut:
    values = {k: v for k, v in body.items() if k in DEFAULTS}
    row = db.get(AppSetting, "general") or AppSetting(key="general", value={})
    row.value = {**row.value, **values}
    db.add(row)
    db.commit()
    return read_settings(db)


# ---------------------------------------------------------------- dashboard
@router.get("/dashboard", response_model=DashboardOut, tags=["Dashboard"])
def dashboard(db: DB, _: Me) -> DashboardOut:
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
            "open": status["new"] + status["preview_ready"],
            "in_review": status["in_review"],
            "approved": status["approved"],
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
