"""User and login API contract."""

from pydantic import BaseModel

from app.core.enums import Role
from app.core.schemas import ORM


class UserIn(BaseModel):
    username: str
    full_name: str = ""
    password: str = ""
    role: Role = Role.TRANSLATOR
    active: bool = True


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Role
    active: bool


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 (OAuth2 token type, not a secret)
    user: UserOut
