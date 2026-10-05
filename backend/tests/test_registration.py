"""Self-registration ("create account" on the login page)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.accounts.models import User
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.enums import Role

PASSWORD = "a-long-password-1"


def register(client: TestClient, username: str, **over: Any) -> Any:
    body = {"username": username, "full_name": "Neue Person", "password": PASSWORD, **over}
    return client.post("/api/auth/register", json=body)


def test_the_login_page_learns_whether_registration_is_open(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert client.get("/api/auth/options").json() == {"registration_enabled": True}
    monkeypatch.setattr(settings, "allow_registration", False)
    assert client.get("/api/auth/options").json() == {"registration_enabled": False}


def test_a_new_account_is_a_translator_and_is_not_signed_in(client: TestClient) -> None:
    r = register(client, "neu.person")
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "translator"
    assert data["username"] == "neu.person"
    assert "access_token" not in data  # signing in is a separate step
    login = client.post("/api/auth/login", data={"username": "neu.person", "password": PASSWORD})
    assert login.status_code == 200
    me = client.get("/api/users/current-user", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.json()["role"] == "translator"


def test_nobody_can_register_with_a_higher_role(client: TestClient) -> None:
    r = register(client, "sneaky", role="admin", active=False)
    assert r.status_code == 201
    assert r.json()["role"] == "translator"
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "sneaky").one()
        assert (user.role, user.active) == (Role.TRANSLATOR, True)


def test_the_password_is_stored_hashed(client: TestClient) -> None:
    register(client, "hash.me")
    with SessionLocal() as db:
        stored = db.query(User).filter(User.username == "hash.me").one().password_hash
    assert PASSWORD not in stored
    assert stored.startswith("$argon2")


@pytest.mark.parametrize("username", ["admin", "ADMIN", "Translator"])
def test_a_username_cannot_be_taken_twice_not_even_in_other_letters(client: TestClient, username: str) -> None:
    r = register(client, username)
    assert r.status_code == 409
    with SessionLocal() as db:
        assert db.query(func.count(User.id)).filter(func.lower(User.username) == username.lower()).scalar() == 1


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("password", "short"),
        ("username", "ab"),
        ("username", "has space"),
        ("username", "ümlaut"),
        ("username", "x" * 51),
        ("full_name", "x" * 101),
    ],
)
def test_invalid_input_is_rejected(client: TestClient, field: str, value: str) -> None:
    body = {"username": "valid.name", "full_name": "Neue Person", "password": PASSWORD} | {field: value}
    assert client.post("/api/auth/register", json=body).status_code == 422


def test_registration_can_be_switched_off(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "allow_registration", False)
    assert register(client, "not.allowed").status_code == 403


def test_one_address_cannot_create_unlimited_accounts(client: TestClient) -> None:
    for i in range(5):
        assert register(client, f"bulk.user{i}").status_code == 201
    blocked = register(client, "bulk.user5")
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
