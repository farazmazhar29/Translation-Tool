"""User and login API contract."""

from pydantic import Field

from app.core.enums import Role
from app.core.schemas import ORM, Schema

MIN_PASSWORD_LENGTH = 10


class RegisterIn(Schema):
    """Self-registration. The role is never chosen by the user: a new account is always a translator."""

    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")
    full_name: str = Field("", max_length=100)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)


class AuthOptions(Schema):
    registration_enabled: bool


class UserIn(Schema):
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


class LoginOut(Schema):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 (OAuth2 token type, not a secret)
    user: UserOut
