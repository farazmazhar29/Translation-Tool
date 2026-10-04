from collections.abc import Iterator
from enum import StrEnum
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import JSON, Dialect, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    type_annotation_map = {  # noqa: RUF012
        dict[str, Any]: JSON,
        list[dict[str, Any]]: JSON,
        list[str]: JSON,
        dict[str, str]: JSON,
        dict[str, list[str]]: JSON,
    }


class Choice[E: StrEnum](TypeDecorator[E]):
    """A `StrEnum` stored as its value in a plain VARCHAR column (the schema is the same as for a string, so no
    migration is needed). Values outside the enum are rejected when they are written and when they are read."""

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
