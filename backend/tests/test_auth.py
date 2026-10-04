import hashlib
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from conftest import Headers, login
from fastapi.testclient import TestClient

from app.accounts import security as auth
from app.accounts.models import User
from app.accounts.router import login_limiter
from app.core.config import settings
from app.core.db import SessionLocal


def legacy_hash(password: str) -> str:
    """The PBKDF2 format of the first version ("salt$digest")."""
    salt = b"0123456789abcdef"
    return f"{salt.hex()}${hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 120_000).hex()}"


def token(claims: dict[str, object], secret: str | None = None) -> Headers:
    return {"Authorization": "Bearer " + jwt.encode(claims, secret or settings.secret_key, algorithm="HS256")}


def hour(delta: int) -> datetime:
    return datetime.now(UTC) + timedelta(hours=delta)


# password hashing
def test_argon2id_roundtrip() -> None:
    stored = auth.hash_password("correct horse battery")
    assert stored.startswith("$argon2id$")
    assert auth.verify_password("correct horse battery", stored)
    assert not auth.verify_password("wrong", stored)
    assert not auth.needs_rehash(stored)


def test_legacy_pbkdf2_hash_still_verifies_and_is_flagged_for_upgrade() -> None:
    stored = legacy_hash("old-password")
    assert auth.verify_password("old-password", stored)
    assert not auth.verify_password("other", stored)
    assert auth.needs_rehash(stored)


@pytest.mark.parametrize("stored", ["", "nothing", "zz$yy", "abcd$", "$argon2id$broken"])
def test_malformed_hashes_never_verify(stored: str) -> None:
    assert not auth.verify_password("anything", stored)


def test_login_upgrades_a_legacy_hash(client: TestClient) -> None:
    with SessionLocal() as db:
        db.add(User(username="legacy_user", password_hash=legacy_hash("legacy-pass-1"), role="translator"))
        db.commit()
    login(client, "legacy_user", "legacy-pass-1")
    with SessionLocal() as db:
        upgraded = db.query(User).filter(User.username == "legacy_user").one().password_hash
    assert upgraded.startswith("$argon2id$")
    login(client, "legacy_user", "legacy-pass-1")  # still works with the new hash


# login behaviour
def test_unknown_user_and_wrong_password_are_indistinguishable(client: TestClient) -> None:
    unknown = client.post("/api/auth/login", data={"username": "nobody", "password": "x"})
    wrong = client.post("/api/auth/login", data={"username": "admin", "password": "x"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_login_is_rate_limited_per_user_and_ip(client: TestClient) -> None:
    for _ in range(settings.login_max_failures):
        assert client.post("/api/auth/login", data={"username": "reviewer", "password": "bad"}).status_code == 401
    blocked = client.post("/api/auth/login", data={"username": "reviewer", "password": "reviewer123"})
    assert blocked.status_code == 429  # even the correct password is refused while blocked
    assert int(blocked.headers["Retry-After"]) > 0
    # another username is not affected
    assert client.post("/api/auth/login", data={"username": "translator", "password": "bad"}).status_code == 401
    login_limiter.clear()
    login(client, "reviewer")


def test_successful_login_resets_the_failure_counter(client: TestClient) -> None:
    for _ in range(settings.login_max_failures - 1):
        client.post("/api/auth/login", data={"username": "admin", "password": "bad"})
    login(client, "admin")
    for _ in range(settings.login_max_failures - 1):
        assert client.post("/api/auth/login", data={"username": "admin", "password": "bad"}).status_code == 401


# tokens
@pytest.mark.parametrize(
    "claims",
    [
        {"sub": "admin", "exp": hour(-1)},  # expired
        {"sub": "admin"},  # no expiry
        {"exp": hour(1)},  # no subject
        {"sub": "ghost", "exp": hour(1)},  # unknown user
    ],
)
def test_invalid_tokens_are_rejected(client: TestClient, claims: dict[str, object]) -> None:
    assert client.get("/api/auth/me", headers=token(claims)).status_code == 401


def test_token_signed_with_another_key_is_rejected(client: TestClient) -> None:
    forged = token({"sub": "admin", "exp": hour(1)}, secret="attacker-key-attacker-key-attacker")
    assert client.get("/api/auth/me", headers=forged).status_code == 401


def test_missing_or_garbage_authorization_is_rejected(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401


# user administration
def test_user_lifecycle_and_password_policy(client: TestClient, admin: Headers) -> None:
    new = {"username": "lifecycle", "full_name": "Life Cycle", "password": "long-enough-1", "role": "translator"}
    assert client.post("/api/users", headers=admin, json={**new, "password": "short"}).status_code == 400
    created = client.post("/api/users", headers=admin, json=new)
    assert created.status_code == 200
    assert client.post("/api/users", headers=admin, json=new).status_code == 409  # duplicate username

    uid = created.json()["id"]
    assert client.put(f"/api/users/{uid}", headers=admin, json={**new, "password": "tiny"}).status_code == 400
    assert client.put(f"/api/users/{uid}", headers=admin, json={**new, "role": "reviewer"}).json()["role"] == "reviewer"

    own = login(client, "lifecycle", "long-enough-1")
    assert client.get("/api/auth/me", headers=own).json()["role"] == "reviewer"
    deactivate = {**new, "role": "reviewer", "active": False, "password": ""}
    assert client.put(f"/api/users/{uid}", headers=admin, json=deactivate).status_code == 200
    assert client.get("/api/auth/me", headers=own).status_code == 401  # an existing token stops working
    assert (
        client.post("/api/auth/login", data={"username": "lifecycle", "password": "long-enough-1"}).status_code == 401
    )


def test_admin_cannot_remove_their_own_admin_role(client: TestClient, admin: Headers) -> None:
    me = client.get("/api/auth/me", headers=admin).json()
    body = {"username": "admin", "full_name": "x", "password": "", "role": "reviewer", "active": True}
    assert client.put(f"/api/users/{me['id']}", headers=admin, json=body).status_code == 400
    assert client.put("/api/users/99999", headers=admin, json=body).status_code == 404


def test_only_admins_manage_users(client: TestClient, reviewer: Headers, translator: Headers) -> None:
    for headers in (reviewer, translator):
        assert client.get("/api/users", headers=headers).status_code == 403
    assert "admin" in client.get("/api/users/names", headers=translator).json()  # names are visible to everyone
