"""Login and user administration."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm

from app.accounts.models import User
from app.accounts.schemas import LoginOut, UserIn, UserOut
from app.accounts.security import DUMMY_HASH, Admin, Me, create_token, hash_password, needs_rehash, verify_password
from app.core.config import settings
from app.core.db import DB
from app.core.enums import Role
from app.core.ratelimit import FailureLimiter, RateLimited

router = APIRouter(prefix="/api")

MIN_PASSWORD_LENGTH = 10
login_limiter = FailureLimiter(settings.login_max_failures, settings.login_window_minutes * 60)


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


@router.get("/auth/me", response_model=UserOut, tags=["Auth"])
def me(user: Me) -> User:
    return user


# Users (admin only)
@router.get("/users", response_model=list[UserOut], tags=["Users"])
def list_users(db: DB, _: Admin) -> list[User]:
    return db.query(User).order_by(User.id).all()


@router.get("/users/names", tags=["Users"], summary="Usernames (for the editor filter)")
def user_names(db: DB, _: Me) -> list[str]:
    return [u.username for u in db.query(User)]


@router.post("/users", response_model=UserOut, tags=["Users"])
def create_user(db: DB, _: Admin, body: UserIn) -> User:
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen haben")
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
    if u.id == admin.id and (body.role != Role.ADMIN or not body.active):
        raise HTTPException(400, "Die eigene Admin-Rolle kann nicht entfernt werden")
    u.full_name, u.role, u.active = body.full_name, body.role, body.active
    if body.password:
        if len(body.password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(400, f"Passwort muss mindestens {MIN_PASSWORD_LENGTH} Zeichen haben")
        u.password_hash = hash_password(body.password)
    db.commit()
    return u
