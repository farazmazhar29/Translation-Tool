"""Logging, first-run seeding and the static-file fallback."""

import json
import logging
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.core.config import settings
from app.core.db import Base
from app.core.logging_setup import JsonFormatter, RequestIdFilter, request_id_var, setup_logging
from app.glossary.models import GlossaryEntry
from app.main import DIST
from app.seed import seed


# Logging
def record(message: str = "hello", *, exc: bool = False) -> logging.LogRecord:
    try:
        if exc:
            raise ValueError("boom")
        info = None
    except ValueError:
        info = sys.exc_info()
    return logging.LogRecord("app.test", logging.WARNING, __file__, 1, message, None, info)


def test_json_log_lines_are_valid_json_with_request_id() -> None:
    rec = record("Übersetzung fertig")
    token = request_id_var.set("req-123")
    try:
        RequestIdFilter().filter(rec)
    finally:
        request_id_var.reset(token)
    entry = json.loads(JsonFormatter().format(rec))
    assert (entry["level"], entry["logger"], entry["message"], entry["request_id"]) == (
        "WARNING",
        "app.test",
        "Übersetzung fertig",
        "req-123",
    )
    assert entry["time"].endswith("+00:00")  # UTC timestamps


def test_json_log_lines_include_exceptions() -> None:
    entry = json.loads(JsonFormatter().format(record(exc=True)))
    assert "ValueError: boom" in entry["exception"]


def test_log_format_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "log_format", "json")
    setup_logging()
    assert isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)
    monkeypatch.setattr(settings, "log_format", "text")
    setup_logging()
    assert not isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)


# First-run seeding
@pytest.fixture
def empty_db() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_demo_mode_creates_demo_users_and_the_sample_glossary(empty_db: Session) -> None:
    seed(empty_db)
    assert {u.username for u in empty_db.query(User)} == {"admin", "reviewer", "translator"}
    assert empty_db.query(GlossaryEntry).count() > 5
    seed(empty_db)  # running again must not duplicate anything
    assert empty_db.query(User).count() == 3


def test_production_mode_creates_only_the_configured_first_admin(
    empty_db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "seed_demo_data", False)
    monkeypatch.setattr(settings, "bootstrap_admin_username", "chef")
    monkeypatch.setattr(settings, "bootstrap_admin_password", "a-long-secret-1")
    seed(empty_db)
    (admin,) = empty_db.query(User).all()
    assert (admin.username, admin.role) == ("chef", "admin")
    assert admin.password_hash.startswith("$argon2id$")
    assert empty_db.query(GlossaryEntry).count() == 0  # no demo content in production


def test_production_mode_without_credentials_creates_nothing(
    empty_db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "seed_demo_data", False)
    monkeypatch.setattr(settings, "bootstrap_admin_username", "")
    seed(empty_db)
    assert empty_db.query(User).count() == 0


def test_existing_users_are_never_overwritten(empty_db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    empty_db.add(User(username="alice", password_hash="x", role="admin"))
    empty_db.commit()
    monkeypatch.setattr(settings, "seed_demo_data", False)
    monkeypatch.setattr(settings, "bootstrap_admin_username", "chef")
    monkeypatch.setattr(settings, "bootstrap_admin_password", "a-long-secret-1")
    seed(empty_db)
    assert [u.username for u in empty_db.query(User)] == ["alice"]


# Serving the built frontend (only when it has been built)
needs_build = pytest.mark.skipif(not DIST.exists(), reason="frontend not built")


@needs_build
def test_unknown_paths_fall_back_to_the_single_page_app(client: TestClient) -> None:
    r = client.get("/projects/42/some/deep/link")
    assert r.status_code == 200
    assert '<div id="root">' in r.text


@needs_build
@pytest.mark.parametrize(
    "path",
    [
        "/..%2f..%2fbackend%2fapp%2fconfig.py",
        "/%2e%2e/%2e%2e/backend/app/config.py",
        "/..%5c..%5cbackend%5capp%5cconfig.py",
    ],
)
def test_the_static_fallback_cannot_read_files_outside_the_build(client: TestClient, path: str) -> None:
    r = client.get(path)
    assert "class Settings" not in r.text  # never the source file
    assert "SECRET_KEY" not in r.text
