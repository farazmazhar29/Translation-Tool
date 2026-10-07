"""What the database itself guarantees, independent of the application code (see migration 0002)."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError

from app import registry
from app.core import migrate
from app.core.config import settings
from app.core.db import Base, Choice

NOW = "2026-10-01 10:00:00"


@pytest.fixture
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    """A throw-away database migrated to the latest revision, with foreign keys enforced like in production."""
    url = f"sqlite:///{tmp_path / 'constraints.db'}"
    engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def _foreign_keys_on(dbapi_connection: Any, _: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    migrate.upgrade_to_head()
    yield engine
    engine.dispose()


def run(engine: Engine, sql: str, **params: Any) -> None:
    with engine.begin() as conn:
        conn.execute(text(sql), params)


def add_project(engine: Engine, pid: int = 1) -> None:
    run(
        engine,
        "INSERT INTO projects (id, name, customer, filename, file_path, file_type, source_lang, detected_lang,"
        " target_langs, status, archived, job_state, job_progress, job_error, structure, created_by, created_at,"
        " updated_at) VALUES (:id, 'P', '', 'f.docx', '/x', 'docx', 'auto', 'de', '[]', 'new', 0, 'idle', 0, '', '{}',"
        " 'u', :t, :t)",
        id=pid,
        t=NOW,
    )


def add_segment(engine: Engine, sid: int = 1, project: int = 1, idx: int = 0) -> None:
    run(
        engine,
        "INSERT INTO segments (id, project_id, idx, locator, source_text) VALUES (:i, :p, :x, '{}', 'Text')",
        i=sid,
        p=project,
        x=idx,
    )


def add_translation(engine: Engine, tid: int, segment: int = 1, lang: str = "en") -> None:
    run(
        engine,
        "INSERT INTO translations (id, segment_id, lang, text, original_text, terms, comment, edited, edited_by,"
        " updated_at) VALUES (:i, :s, :l, 't', 't', '[]', '', 0, '', :t)",
        i=tid,
        s=segment,
        l=lang,
        t=NOW,
    )


def add_release(engine: Engine, rid: int = 1, project: int = 1) -> None:
    run(
        engine,
        "INSERT INTO releases (id, project_id, approved_by, editors, glossary_version, change_count, preview, final,"
        " warnings, created_at) VALUES (:i, :p, 'r', '[]', 0, 0, '{}', '{}', '[]', :t)",
        i=rid,
        p=project,
        t=NOW,
    )


def add_export(engine: Engine, eid: int = 1, project: int = 1, release: int | None = None) -> None:
    run(
        engine,
        "INSERT INTO export_files (id, project_id, release_id, format, lang, mode, filename, path, created_by,"
        " created_at) VALUES (:i, :p, :r, 'docx', 'en', 'translation', 'a.docx', '/a', 'u', :t)",
        i=eid,
        p=project,
        r=release,
        t=NOW,
    )


def count(engine: Engine, table: str) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())  # noqa: S608 (fixed table names)


def test_every_enum_column_has_a_check_constraint_in_the_database(db: Engine) -> None:
    """Fails when a new `Choice` column is added without the matching CHECK in the model and the migration."""
    assert registry.TABLE_MODULES != ()  # all models are imported, so the metadata lists every table
    inspector = inspect(db)
    for table in Base.metadata.sorted_tables:
        checks = {c["name"] for c in inspector.get_check_constraints(table.name)}
        for column in table.columns:
            if isinstance(column.type, Choice):
                assert f"ck_{table.name}_{column.name}" in checks, f"{table.name}.{column.name}"


def test_the_database_rejects_values_outside_an_enum(db: Engine) -> None:
    add_project(db)
    with pytest.raises(IntegrityError):
        run(db, "UPDATE projects SET status = 'banana'")
    with pytest.raises(IntegrityError):
        run(db, "UPDATE projects SET job_state = 'banana'")
    with pytest.raises(IntegrityError):
        run(db, "INSERT INTO users (username, full_name, password_hash, role, active) VALUES ('x', '', 'h', 'boss', 1)")
    add_export(db)
    with pytest.raises(IntegrityError):
        run(db, "UPDATE export_files SET mode = 'banana'")


def test_the_database_rejects_values_outside_a_range(db: Engine) -> None:
    add_project(db)
    with pytest.raises(IntegrityError):
        run(db, "UPDATE projects SET job_progress = 101")
    with pytest.raises(IntegrityError):
        add_segment(db, idx=-1)


def test_a_segment_has_one_position_and_one_translation_per_language(db: Engine) -> None:
    add_project(db)
    add_segment(db, sid=1, idx=0)
    with pytest.raises(IntegrityError):
        add_segment(db, sid=2, idx=0)  # same position twice
    add_translation(db, 1, lang="en")
    add_translation(db, 2, lang="de")
    with pytest.raises(IntegrityError):
        add_translation(db, 3, lang="en")  # same language twice


def test_foreign_keys_reject_orphans(db: Engine) -> None:
    with pytest.raises(IntegrityError):
        add_segment(db, project=999)
    with pytest.raises(IntegrityError):
        add_export(db, project=999)


def test_deleting_a_project_removes_everything_that_belongs_to_it(db: Engine) -> None:
    add_project(db)
    add_segment(db)
    add_translation(db, 1)
    add_release(db)
    add_export(db, release=1)
    run(db, "DELETE FROM projects WHERE id = 1")
    assert [count(db, t) for t in ("segments", "translations", "releases", "export_files")] == [0, 0, 0, 0]


def test_deleting_a_release_keeps_its_exports_but_forgets_the_link(db: Engine) -> None:
    add_project(db)
    add_release(db)
    add_export(db, release=1)
    run(db, "DELETE FROM releases WHERE id = 1")
    with db.connect() as conn:
        assert conn.execute(text("SELECT release_id FROM export_files")).scalar_one() is None


def test_an_export_cannot_point_to_a_release_that_does_not_exist(db: Engine) -> None:
    add_project(db)
    with pytest.raises(IntegrityError):
        add_export(db, release=42)


def test_upgrading_repairs_data_the_new_rules_would_reject(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A database from before migration 0002 may hold duplicate translations and `release_id = 0` for "none"."""
    url = f"sqlite:///{tmp_path / 'old.db'}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    command.upgrade(migrate.alembic_config(), "0001")
    add_project(engine)
    add_segment(engine)
    add_translation(engine, 1, lang="en")
    add_translation(engine, 2, lang="en")  # the newer duplicate wins
    add_release(engine)
    add_export(engine, eid=1, release=0)
    add_export(engine, eid=2, release=1)
    migrate.upgrade_to_head()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT id FROM translations")).scalars().all() == [2]
        assert conn.execute(text("SELECT release_id FROM export_files ORDER BY id")).scalars().all() == [None, 1]
    engine.dispose()


def test_projects_that_were_in_review_wait_for_approval_after_the_upgrade(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Migration 0003 removed the separate "in review" state: those projects are now simply "preview_ready"."""
    url = f"sqlite:///{tmp_path / 'review.db'}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    command.upgrade(migrate.alembic_config(), "0002")
    add_project(engine)
    run(engine, "UPDATE projects SET status = 'in_review'")  # allowed before the migration
    migrate.upgrade_to_head()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT status FROM projects")).scalar_one() == "preview_ready"
    with pytest.raises(IntegrityError):
        run(engine, "UPDATE projects SET status = 'in_review'")  # and refused afterwards
    engine.dispose()


def test_projects_with_the_status_archived_become_approved_and_archived(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Migration 0006 made archiving only a flag: the old status "archived" meant approved and archived."""
    url = f"sqlite:///{tmp_path / 'archived.db'}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    command.upgrade(migrate.alembic_config(), "0005")
    add_project(engine)
    run(engine, "UPDATE projects SET status = 'archived', archived = 0")  # allowed before the migration
    migrate.upgrade_to_head()
    with engine.connect() as conn:
        assert tuple(conn.execute(text("SELECT status, archived FROM projects")).one()) == ("approved", 1)
    with pytest.raises(IntegrityError):
        run(engine, "UPDATE projects SET status = 'archived'")  # and refused afterwards
    engine.dispose()


def test_downgrade_restores_the_previous_schema(db: Engine) -> None:
    add_project(db)
    add_export(db)  # no release: stored as 0 again after the downgrade
    command.downgrade(migrate.alembic_config(), "0001")
    with db.connect() as conn:
        assert conn.execute(text("SELECT release_id FROM export_files")).scalar_one() == 0
    assert not inspect(db).get_check_constraints("projects")
