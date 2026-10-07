"""Login and user administration."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func

from app.accounts.models import RetiredUsername, User
from app.accounts.schemas import MIN_PASSWORD_LENGTH, AuthOptions, LoginOut, RegisterIn, UserIn, UserOut
from app.accounts.security import DUMMY_HASH, Admin, Me, create_token, hash_password, needs_rehash, verify_password
from app.core.config import settings
from app.core.db import DB
from app.core.enums import Role
from app.core.errors import AppError, ErrorCode
from app.core.ratelimit import FailureLimiter, RateLimited

router = APIRouter(prefix="/api")

login_limiter = FailureLimiter(settings.login_max_failures, settings.login_window_minutes * 60)


def minutes(e: RateLimited) -> int:
    """The wait in whole minutes, rounded up, for the message."""
    return e.retry_after // 60 + 1


def check_username_free(db: DB, username: str) -> None:
    """Case-insensitive ("Admin" next to "admin" would be a look-alike account), and never the name of a deleted
    user, which the history still shows."""
    name = username.lower()
    if db.query(User).filter(func.lower(User.username) == name).first():
        raise AppError(409, ErrorCode.USERNAME_TAKEN, "Username already exists")
    if db.get(RetiredUsername, name):
        raise AppError(
            409, ErrorCode.USERNAME_RETIRED, "This username belonged to a deleted account and is not given again"
        )


@router.post("/auth/login", tags=["Auth"], summary="Log in (rate limited per IP and username)")
def login(db: DB, request: Request, form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> LoginOut:
    key = f"{request.client.host if request.client else '-'}|{form.username.lower()}"
    try:
        login_limiter.check(key)
    except RateLimited as e:
        raise AppError(
            429,
            ErrorCode.TOO_MANY_ATTEMPTS,
            f"Too many failed attempts. Please try again in {minutes(e)} minute(s).",
            {"minutes": minutes(e)},
            headers={"Retry-After": str(e.retry_after)},
        ) from None
    u = db.query(User).filter(User.username == form.username, User.active).first()
    # Always verify a hash, so unknown users cost the same time as wrong passwords.
    if not verify_password(form.password, u.password_hash if u else DUMMY_HASH) or u is None:
        login_limiter.fail(key)
        raise AppError(401, ErrorCode.WRONG_CREDENTIALS, "Wrong username or password")
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
        raise AppError(403, ErrorCode.REGISTRATION_DISABLED, "Registration is disabled")
    key = request.client.host if request.client else "-"
    try:
        register_limiter.check(key)
    except RateLimited as e:
        raise AppError(
            429,
            ErrorCode.TOO_MANY_REGISTRATIONS,
            f"Too many registrations. Please try again in {minutes(e)} minute(s).",
            {"minutes": minutes(e)},
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
        raise AppError(
            400,
            ErrorCode.PASSWORD_TOO_SHORT,
            f"The password must have at least {MIN_PASSWORD_LENGTH} characters",
            {"min": MIN_PASSWORD_LENGTH},
        )
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
        raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
    if u.id == admin.id and (body.role != Role.ADMIN or not body.active):
        raise AppError(400, ErrorCode.OWN_ADMIN_ROLE, "You cannot remove your own admin role")
    u.full_name, u.role, u.active = body.full_name, body.role, body.active
    if body.password:
        if len(body.password) < MIN_PASSWORD_LENGTH:
            raise AppError(
                400,
                ErrorCode.PASSWORD_TOO_SHORT,
                f"The password must have at least {MIN_PASSWORD_LENGTH} characters",
                {"min": MIN_PASSWORD_LENGTH},
            )
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
        raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
    if u.id == admin.id:
        raise AppError(400, ErrorCode.OWN_ACCOUNT, "You cannot delete your own account")
    db.add(RetiredUsername(username=u.username.lower(), retired_by=admin.username))
    db.delete(u)
    db.commit()
    return {"deleted": True}
