"""User accounts."""

from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Choice, now, one_of
from app.core.enums import Role


class User(Base):
    __tablename__ = "users"
    __table_args__ = (one_of("users", "role", Role),)
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    full_name: Mapped[str] = mapped_column(default="")
    password_hash: Mapped[str]
    role: Mapped[Role] = mapped_column(Choice(Role), default=Role.TRANSLATOR)
    active: Mapped[bool] = mapped_column(default=True)


class RetiredUsername(Base):
    """The name of a deleted user. History keeps naming the user (`created_by`, `approved_by` ... are plain text), so
    the name must never belong to someone else: nobody can register or be given it again."""

    __tablename__ = "retired_usernames"
    username: Mapped[str] = mapped_column(primary_key=True)  # lower case, like the case-insensitive check
    retired_by: Mapped[str] = mapped_column(default="")
    retired_at: Mapped[datetime] = mapped_column(default=now)
