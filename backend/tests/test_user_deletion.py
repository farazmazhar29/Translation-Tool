"""Deleting a user: the history keeps the name, and the name is never given to anyone else."""

import uuid

from conftest import Headers, docx_bytes, login, upload
from fastapi.testclient import TestClient

PASSWORD = "lang-genug-123"


def new_user(client: TestClient, admin: Headers, name: str | None = None) -> tuple[int, str]:
    username = name or f"weg{uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/users",
        headers=admin,
        json={"username": username, "full_name": "Wird gelöscht", "password": PASSWORD, "role": "translator"},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"], username


def test_a_deleted_user_is_gone_but_their_work_still_names_them(client: TestClient, admin: Headers) -> None:
    uid, name = new_user(client, admin)
    own = login(client, name, PASSWORD)
    pid = upload(client, own, "von-ihm.docx", docx_bytes("Der Korpus ist weiß und gut."))["id"]

    assert client.delete(f"/api/users/{uid}", headers=admin).json() == {"deleted": True}

    assert name not in [u["username"] for u in client.get("/api/users", headers=admin).json()]
    assert client.get(f"/api/projects/{pid}", headers=admin).json()["created_by"] == name  # the history keeps it
    assert name in client.get("/api/users/names", headers=admin).json()  # still offered by the editor filter
    assert client.get("/api/users/current-user", headers=own).status_code == 401  # the old token is dead
    signin = client.post("/api/auth/login", data={"username": name, "password": PASSWORD})
    assert signin.status_code == 401


def test_the_name_of_a_deleted_user_is_never_given_again(client: TestClient, admin: Headers) -> None:
    uid, name = new_user(client, admin)
    client.delete(f"/api/users/{uid}", headers=admin)
    again = client.post(
        "/api/users",
        headers=admin,
        json={"username": name, "full_name": "", "password": PASSWORD, "role": "translator"},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "username_retired"
    registered = client.post(
        "/api/auth/register", json={"username": name.upper(), "full_name": "", "password": PASSWORD}
    )  # also in other letter case
    assert registered.status_code == 409


def test_creating_a_user_compares_names_without_case(client: TestClient, admin: Headers) -> None:
    _, name = new_user(client, admin)
    twin = client.post(
        "/api/users",
        headers=admin,
        json={"username": name.upper(), "full_name": "", "password": PASSWORD, "role": "translator"},
    )
    assert (twin.status_code, twin.json()["code"], twin.json()["detail"]) == (
        409,
        "username_taken",
        "Username already exists",
    )


def test_admins_cannot_delete_themselves_and_others_cannot_delete_at_all(
    client: TestClient, admin: Headers, translator: Headers
) -> None:
    me = client.get("/api/users/current-user", headers=admin).json()["id"]
    assert client.delete(f"/api/users/{me}", headers=admin).status_code == 400
    assert client.delete("/api/users/999999", headers=admin).status_code == 404
    uid, _ = new_user(client, admin)
    assert client.delete(f"/api/users/{uid}", headers=translator).status_code == 403
