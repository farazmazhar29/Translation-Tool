import hashlib
import hmac
import os
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from .config import settings
from .db import DB
from .models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
RANK = {"translator": 1, "reviewer": 2, "admin": 3}  # role hierarchy


def _digest(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000).hex()


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    return f"{salt.hex()}${_digest(password, salt)}"


def verify_password(password: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    return bool(digest) and hmac.compare_digest(_digest(password, bytes.fromhex(salt)), digest)


def create_token(user: User) -> str:
    exp = datetime.now(UTC) + timedelta(hours=settings.token_hours)
    return jwt.encode({"sub": user.username, "exp": exp}, settings.secret_key, algorithm="HS256")


def current_user(token: Annotated[str, Depends(oauth2)], db: DB) -> User:
    try:
        name = str(jwt.decode(token, settings.secret_key, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError):
        raise HTTPException(401, "Nicht angemeldet") from None
    user = db.query(User).filter(User.username == name, User.active).first()
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
