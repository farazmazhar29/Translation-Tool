"""User accounts."""

from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Choice
from app.core.enums import Role


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    full_name: Mapped[str] = mapped_column(default="")
    password_hash: Mapped[str]
    role: Mapped[Role] = mapped_column(Choice(Role), default=Role.TRANSLATOR)
    active: Mapped[bool] = mapped_column(default=True)
