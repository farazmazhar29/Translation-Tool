import hashlib
import hmac
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from .config import settings
from .db import DB
from .models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
RANK = {"translator": 1, "reviewer": 2, "admin": 3}  # role hierarchy

# Argon2id with the library defaults (RFC 9106 "low memory" profile) – above OWASP's minimum (19 MiB, t=2, p=1).
_hasher = PasswordHasher()
_LEGACY_ITERATIONS = 120_000  # first version used PBKDF2-SHA256 ("salt$digest"); still verified, then upgraded


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def _verify_legacy(password: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    try:
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _LEGACY_ITERATIONS).hex()
    except ValueError:
        return False
    return bool(digest) and hmac.compare_digest(candidate, digest)


def verify_password(password: str, stored: str) -> bool:
    if not stored.startswith("$argon2"):
        return _verify_legacy(password, stored)
    try:
        return _hasher.verify(stored, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(stored: str) -> bool:
    """True for legacy PBKDF2 hashes and for Argon2 hashes created with outdated parameters."""
    return not stored.startswith("$argon2") or _hasher.check_needs_rehash(stored)


# Verified for unknown usernames so that "no such user" and "wrong password" take the same time.
DUMMY_HASH = hash_password("timing-equalisation-only")


def create_token(user: User) -> str:
    exp = datetime.now(UTC) + timedelta(hours=settings.token_hours)
    return jwt.encode({"sub": user.username, "exp": exp}, settings.secret_key, algorithm="HS256")


def current_user(token: Annotated[str, Depends(oauth2)], db: DB) -> User:
    try:
        claims = jwt.decode(token, settings.secret_key, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(401, "Nicht angemeldet") from None
    user = db.query(User).filter(User.username == str(claims["sub"]), User.active).first()
    if user is None:
        raise HTTPException(401, "Nicht angemeldet")
    return user


def require_role(minimum: str) -> Callable[[User], User]:
    def dep(user: Annotated[User, Depends(current_user)]) -> User:
        if RANK[user.role] < RANK[minimum]:
            raise HTTPException(403, "Keine Berechtigung")
        return user

    return dep


Me = Annotated[User, Depends(current_user)]
Translator = Annotated[User, Depends(require_role("translator"))]
Reviewer = Annotated[User, Depends(require_role("reviewer"))]
Admin = Annotated[User, Depends(require_role("admin"))]
