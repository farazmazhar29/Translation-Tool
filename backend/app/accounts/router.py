"""Login and user administration."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func

from app.accounts.models import RetiredUsername, User
from app.accounts.schemas import MIN_PASSWORD_LENGTH, AuthOptions, LoginOut, RegisterIn, UserIn, UserOut
from app.accounts.security import DUMMY_HASH, Admin, Me, create_token, hash_password, needs_rehash, verify_password
from app.core.config import settings
from app.core.db import DB
from app.core.enums import Role
from app.core.ratelimit import FailureLimiter, RateLimited

router = APIRouter(prefix="/api")

login_limiter = FailureLimiter(settings.login_max_failures, settings.login_window_minutes * 60)


def check_username_free(db: DB, username: str) -> None:
    """Case-insensitive ("Admin" next to "admin" would be a look-alike account), and never the name of a deleted
    user, which the history still shows."""
    name = username.lower()
    if db.query(User).filter(func.lower(User.username) == name).first():
        raise HTTPException(409, "Benutzername existiert bereits")
    if db.get(RetiredUsername, name):
        raise HTTPException(409, "Dieser Benutzername gehörte einem gelöschten Konto und wird nicht neu vergeben")


@router.post("/auth/login", tags=["Auth"], summary="Log in (rate limited per IP and username)")
def login(db: DB, request: Request, form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> LoginOut:
    key = f"{request.client.host if request.client else '-'}|{form.username.lower()}"
    try:
        login_limiter.check(key)
    except RateLimited as e:
        raise HTTPException(
            429,
            f"Zu viele Fehlversuche. Bitte in {e.retry_after // 60 + 1} Minute(n) erneut versuchen.",
            headers={"Retry-After": str(e.retry_after)},
        ) from None
    u = db.query(User).filter(User.username == form.username, User.active).first()
    # Always verify a hash, so unknown users cost the same time as wrong passwords.
    if not verify_password(form.password, u.password_hash if u else DUMMY_HASH) or u is None:
        login_limiter.fail(key)
        raise HTTPException(401, "Benutzername oder Passwort falsch")
    login_limiter.reset(key)
    if needs_rehash(u.password_hash):  # transparently upgrade legacy PBKDF2 / outdated Argon2 parameters
        u.password_hash = hash_password(form.password)
        db.commit()
    return LoginOut(access_token=create_token(u), user=UserOut.model_validate(u))


register_limiter = FailureLimiter(5, 3600)  # at most 5 new accounts per IP address and hour


@router.get("/auth/options", tags=["Auth"], summary="What the login page may offer")
def auth_options() -> AuthOptions:
    return AuthOptions(registration_enabled=settings.allow_registration)


@router.post(
    "/auth/register",
    status_code=201,
    tags=["Auth"],
    summary="Create an account (always a translator); the user signs in afterwards",
)
def register(db: DB, request: Request, body: RegisterIn) -> UserOut:
    if not settings.allow_registration:
        raise HTTPException(403, "Die Registrierung ist deaktiviert.")
    key = request.client.host if request.client else "-"
    try:
        register_limiter.check(key)
    except RateLimited as e:
        raise HTTPException(
            429,
            f"Zu viele Registrierungen. Bitte in {e.retry_after // 60 + 1} Minute(n) erneut versuchen.",
            headers={"Retry-After": str(e.retry_after)},
        ) from None
    check_username_free(db, body.username)
    u = User(
        username=body.username,
        full_name=body.full_name.strip(),
        role=Role.TRANSLATOR,
        password_hash=hash_password(body.password),
    )
    db.add(u)
    db.commit()
    register_limiter.fail(key)  # every new account counts against the limit
    return UserOut.model_validate(u)  # no token: signing in is a separate step


@router.get(
    "/users/current-user", response_model=UserOut, tags=["Users"], summary="The signed-in user (profile and role)"
)
def read_current_user(user: Me) -> User:
    """What the browser asks on every page load: who owns this token, and what may they do?"""
    return user


# Users (admin only)
@router.get("/users", response_model=list[UserOut], tags=["Users"])
def list_users(db: DB, _: Admin) -> list[User]:
    return db.query(User).order_by(User.id).all()


@router.get("/users/names", tags=["Users"], summary="Usernames (for the editor filter), deleted users included")
def user_names(db: DB, _: Me) -> list[str]:
    # a deleted user's work stays in the history, so the filter still offers the name (as it was written)
    names = [u.username for u in db.query(User)]
    known = {n.lower() for n in names}
    return names + [r.username for r in db.query(RetiredUsername) if r.username not in known]


@router.post("/users", response_model=UserOut, tags=["Users"])
def create_user(db: DB, _: Admin, body: UserIn) -> User:
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen haben")
    check_username_free(db, body.username)
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
    if u.id == admin.id and (body.role != Role.ADMIN or not body.active):
        raise HTTPException(400, "Die eigene Admin-Rolle kann nicht entfernt werden")
    u.full_name, u.role, u.active = body.full_name, body.role, body.active
    if body.password:
        if len(body.password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(400, f"Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen haben")
        u.password_hash = hash_password(body.password)
    db.commit()
    return u


@router.delete(
    "/users/{uid}",
    tags=["Users"],
    summary="Delete a user; their name stays in the history and is never given to anyone else",
)
def delete_user(db: DB, admin: Admin, uid: int) -> dict[str, bool]:
    """Projects, approvals, exports and glossary changes store who made them as text, so they keep the name. The name is
    retired: a new account with it could otherwise pass for the author of that work. The caller stays an admin, so
    deleting never leaves the application without one."""
    u = db.get(User, uid)
    if u is None:
        raise HTTPException(404, "Benutzer nicht gefunden")
    if u.id == admin.id:
        raise HTTPException(400, "Das eigene Konto kann nicht gelöscht werden")
    db.add(RetiredUsername(username=u.username.lower(), retired_by=admin.username))
    db.delete(u)
    db.commit()
    return {"deleted": True}
