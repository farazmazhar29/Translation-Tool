"""Alembic: the migrations must build exactly the schema the models describe."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import Engine, create_engine, inspect, text

from app.core import migrate
from app.core.config import settings
from app.core.db import Base

EXPECTED_TABLES = {
    "users", "projects", "segments", "translations", "glossary_entries", "glossary_versions",
    "releases", "export_files", "app_settings", "export_templates",
}  # fmt: skip


@pytest.fixture
def fresh_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    """An empty throw-away database that both the migration environment and app.migrate point at."""
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    yield engine
    engine.dispose()


def tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def test_upgrade_creates_every_table_and_records_the_revision(fresh_db: Engine) -> None:
    migrate.upgrade_to_head()
    assert tables(fresh_db) == EXPECTED_TABLES | {"alembic_version"}
    with fresh_db.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0001"


def test_models_and_migrations_have_not_drifted_apart(fresh_db: Engine) -> None:
    """Fails when someone changes a model without writing the migration (`alembic revision --autogenerate`)."""
    migrate.upgrade_to_head()
    command.check(migrate.alembic_config())  # raises CommandError if autogenerate would produce changes


def test_upgrading_twice_is_harmless(fresh_db: Engine) -> None:
    migrate.upgrade_to_head()
    migrate.upgrade_to_head()
    assert tables(fresh_db) == EXPECTED_TABLES | {"alembic_version"}


def test_downgrade_removes_everything(fresh_db: Engine) -> None:
    migrate.upgrade_to_head()
    command.downgrade(migrate.alembic_config(), "base")
    assert tables(fresh_db) == {"alembic_version"}


def test_a_database_from_the_first_version_is_adopted_not_rebuilt(fresh_db: Engine) -> None:
    """Version 1 created tables with `create_all` and had no migration history."""
    Base.metadata.create_all(fresh_db)
    assert "alembic_version" not in tables(fresh_db)
    migrate.upgrade_to_head()  # must not fail with "table already exists"
    with fresh_db.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0001"
    assert tables(fresh_db) == EXPECTED_TABLES | {"alembic_version"}


def test_offline_mode_renders_sql_without_a_database(fresh_db: Engine, capsys: pytest.CaptureFixture[str]) -> None:
    command.upgrade(migrate.alembic_config(), "head", sql=True)
    assert "CREATE TABLE projects" in capsys.readouterr().out
    assert tables(fresh_db) == set()  # nothing was executed
