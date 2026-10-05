from collections.abc import Iterator
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import JSON, CheckConstraint, Dialect, String, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _enforce_foreign_keys(dbapi_connection: Any, _: Any) -> None:
    """SQLite ignores foreign keys unless asked; PostgreSQL always enforces them. Make both behave the same."""
    if settings.database_url.startswith("sqlite"):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # naive UTC, portable across SQLite/Postgres


class Base(DeclarativeBase):
    type_annotation_map = {  # noqa: RUF012
        dict[str, Any]: JSON,
        list[dict[str, Any]]: JSON,
        list[str]: JSON,
        dict[str, str]: JSON,
        dict[str, list[str]]: JSON,
    }


def one_of(table: str, column: str, enum: type[StrEnum]) -> CheckConstraint:
    """Database-level check that a `Choice` column only holds values of its enum (also for direct SQL access)."""
    values = ", ".join(f"'{member.value}'" for member in enum)
    return CheckConstraint(f"{column} IN ({values})", name=f"ck_{table}_{column}")


class Choice[E: StrEnum](TypeDecorator[E]):
    """A `StrEnum` stored as its value in a plain VARCHAR column. Values outside the enum are rejected when they are
    written and when they are read; `one_of` adds the matching CHECK constraint to the table."""

    impl = String
    cache_ok = True

    def __init__(self, enum: type[E]) -> None:
        super().__init__()
        self.enum = enum

    def process_bind_param(self, value: E | str | None, dialect: Dialect) -> str | None:  # noqa: ARG002 (SQLAlchemy API)
        return None if value is None else self.enum(value).value

    def process_result_value(self, value: str | None, dialect: Dialect) -> E | None:  # noqa: ARG002 (SQLAlchemy API)
        return None if value is None else self.enum(value)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


DB = Annotated[Session, Depends(get_db)]
