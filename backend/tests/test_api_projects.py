"""Project management: search and filters, editing, copying, archiving, deleting."""

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pytest
from conftest import Headers, docx_bytes, upload
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.db import SessionLocal
from app.export.models import ExportFile
from app.projects.models import Project


def token() -> str:
    return uuid.uuid4().hex[:10]


def make(client: TestClient, headers: Headers, **form: str) -> dict[str, Any]:
    return upload(client, headers, form.pop("filename", "doc.docx"), docx_bytes("Der Korpus ist weiß und gut."), **form)


def listing(client: TestClient, headers: Headers, **params: Any) -> list[dict[str, Any]]:
    r = client.get("/api/projects", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def names(rows: list[dict[str, Any]]) -> set[str]:
    return {r["name"] for r in rows}


# Search and filters
def test_search_matches_name_filename_and_customer(client: TestClient, translator: Headers) -> None:
    t = token()
    make(client, translator, name=f"Projekt {t}")
    make(client, translator, name="x", customer=f"Kunde {t}")
    make(client, translator, name="y", filename=f"{t}.docx")
    make(client, translator, name="unrelated")
    found = listing(client, translator, q=t)
    assert len(found) == 3
    assert "unrelated" not in names(found)


def test_filters_by_status_language_and_customer(client: TestClient, translator: Headers) -> None:
    t = token()
    fresh = make(client, translator, name=f"{t}-new", customer=f"cust-{t}")
    done = make(client, translator, name=f"{t}-done", customer=f"cust-{t}")
    client.post(f"/api/projects/{done['id']}/translate", headers=translator)
    both = {fresh["id"], done["id"]}
    assert {r["id"] for r in listing(client, translator, q=t, status="new")} == {fresh["id"]}
    assert {r["id"] for r in listing(client, translator, q=t, status="preview_ready")} == {done["id"]}
    assert {r["id"] for r in listing(client, translator, customer=f"cust-{t}")} == both
    assert {r["id"] for r in listing(client, translator, q=t, lang="en")} == both  # a target language ...
    assert {r["id"] for r in listing(client, translator, q=t, lang="de")} == both  # ... or the detected source language
    assert listing(client, translator, q=t, lang="fr") == []


def test_archived_projects_are_hidden_by_default(client: TestClient, translator: Headers) -> None:
    t = token()
    project = make(client, translator, name=t)
    client.post(f"/api/projects/{project['id']}/archive", headers=translator)
    assert listing(client, translator, q=t) == []
    assert len(listing(client, translator, q=t, archived="only")) == 1
    assert len(listing(client, translator, q=t, archived="all")) == 1
    client.post(f"/api/projects/{project['id']}/unarchive", headers=translator)
    assert len(listing(client, translator, q=t)) == 1
    assert listing(client, translator, q=t, archived="only") == []


def test_search_inside_original_and_translated_text(client: TestClient, translator: Headers, reviewer: Headers) -> None:
    t = token()
    pid = upload(client, translator, "t.docx", docx_bytes(f"Der Korpus {t}marker ist weiß und gut."), name=t)["id"]
    assert [r["id"] for r in listing(client, translator, term=f"{t}marker")] == [pid]  # original text
    client.post(f"/api/projects/{pid}/translate", headers=translator)
    assert [r["id"] for r in listing(client, translator, term="carcass", q=t)] == [pid]  # translated text
    assert listing(client, translator, term="doesnotoccuranywhere") == []


def test_filter_by_the_person_who_edited_or_approved(
    client: TestClient, translator: Headers, reviewer: Headers
) -> None:
    t = token()
    approved = make(client, translator, name=f"{t}-approved")
    make(client, translator, name=f"{t}-open")
    client.post(f"/api/projects/{approved['id']}/translate", headers=translator)
    client.post(f"/api/projects/{approved['id']}/approve", headers=reviewer)
    assert names(listing(client, translator, q=t, editor="reviewer")) == {f"{t}-approved"}
    assert names(listing(client, translator, q=t, editor="translator")) == {f"{t}-approved", f"{t}-open"}  # creator
    assert listing(client, translator, q=t, editor="nobody") == []


def test_filter_by_period(client: TestClient, translator: Headers) -> None:
    t = token()
    make(client, translator, name=t)
    today = datetime.now(UTC).date()
    assert len(listing(client, translator, q=t, date_from=today.isoformat(), date_to=today.isoformat())) == 1
    assert listing(client, translator, q=t, date_from=(today + timedelta(days=1)).isoformat()) == []
    assert listing(client, translator, q=t, date_to=(today - timedelta(days=1)).isoformat()) == []


def test_results_are_newest_first_and_can_be_limited(client: TestClient, translator: Headers) -> None:
    t = token()
    for i in range(3):
        make(client, translator, name=f"{t}-{i}")
    rows = listing(client, translator, q=t)
    assert [r["name"] for r in rows] == [f"{t}-2", f"{t}-1", f"{t}-0"]
    assert [r["name"] for r in listing(client, translator, q=t, limit=2)] == [f"{t}-2", f"{t}-1"]


@pytest.mark.parametrize("limit", [0, -1, 1001, "abc"])
def test_invalid_limits_are_rejected(client: TestClient, translator: Headers, limit: str | int) -> None:
    assert client.get("/api/projects", headers=translator, params={"limit": limit}).status_code == 422


# Editing, copying, archiving
def test_rename_and_change_languages(client: TestClient, translator: Headers) -> None:
    pid = make(client, translator)["id"]
    r = client.patch(
        f"/api/projects/{pid}",
        headers=translator,
        json={"name": "Neu", "customer": "ACME", "source_lang": "en", "target_langs": ["en", "de"]},
    )
    assert r.status_code == 200
    # the target is not chosen: it is always the other language, and follows the source
    assert (r.json()["name"], r.json()["customer"], r.json()["source_lang"], r.json()["target_langs"]) == (
        "Neu",
        "ACME",
        "en",
        ["de"],
    )


@pytest.mark.parametrize("body", [{"name": ""}, {"name": "x" * 201}, {"source_lang": "fr"}])
def test_invalid_project_changes_are_rejected(client: TestClient, translator: Headers, body: dict[str, Any]) -> None:
    pid = make(client, translator)["id"]
    assert client.patch(f"/api/projects/{pid}", headers=translator, json=body).status_code == 422


def test_translating_with_an_unknown_language_is_rejected(client: TestClient, translator: Headers) -> None:
    pid = make(client, translator)["id"]
    assert (
        client.post(f"/api/projects/{pid}/translate", headers=translator, json={"source_lang": "klingon"}).status_code
        == 422
    )


def test_copy_without_translations_starts_fresh(client: TestClient, translator: Headers) -> None:
    original = make(client, translator, name="Original")
    client.post(f"/api/projects/{original['id']}/translate", headers=translator)
    copy = client.post(f"/api/projects/{original['id']}/copy", headers=translator).json()
    assert copy["name"] == "Original (Kopie)"
    assert copy["status"] == "new"
    detail = client.get(f"/api/projects/{copy['id']}", headers=translator).json()
    assert all(s["translations"] == {} for s in detail["segments"])
    with SessionLocal() as db:
        a, b = db.get(Project, original["id"]), db.get(Project, copy["id"])
        assert a is not None
        assert b is not None
        assert a.file_path != b.file_path  # the copy owns its file
        assert Path(b.file_path).exists()


def test_copy_with_translations_keeps_them_and_is_independent(client: TestClient, translator: Headers) -> None:
    original = make(client, translator)
    client.post(f"/api/projects/{original['id']}/translate", headers=translator)
    copy = client.post(
        f"/api/projects/{original['id']}/copy", headers=translator, params={"with_translations": True}
    ).json()
    assert copy["status"] == "preview_ready"
    copied = client.get(f"/api/projects/{copy['id']}", headers=translator).json()["segments"][0]
    source = client.get(f"/api/projects/{original['id']}", headers=translator).json()["segments"][0]
    assert copied["translations"]["en"]["text"] == source["translations"]["en"]["text"]
    client.put(f"/api/segments/{copied['id']}/en", headers=translator, json={"text": "only in the copy"})
    untouched = client.get(f"/api/projects/{original['id']}", headers=translator).json()["segments"][0]
    assert untouched["translations"]["en"]["text"] == source["translations"]["en"]["text"]


def test_reopening_an_archived_project(client: TestClient, translator: Headers, reviewer: Headers) -> None:
    pid = make(client, translator)["id"]
    client.post(f"/api/projects/{pid}/translate", headers=translator)
    client.post(f"/api/projects/{pid}/approve", headers=reviewer)
    client.post(f"/api/projects/{pid}/export", headers=translator, json={"lang": "en", "archive_after": True})
    assert client.get(f"/api/projects/{pid}", headers=translator).json()["archived"] is True
    reopened = client.post(f"/api/projects/{pid}/reopen", headers=translator).json()
    assert (reopened["archived"], reopened["status"]) == (False, "preview_ready")


def test_download_the_original_file(client: TestClient, translator: Headers) -> None:
    data = docx_bytes("Der Korpus ist weiß und gut.")
    pid = upload(client, translator, "Mein Original.docx", data)["id"]
    r = client.get(f"/api/projects/{pid}/original", headers=translator)
    assert r.content == data
    assert quote("Mein Original.docx") in r.headers["content-disposition"]


# Deleting
def test_only_admins_delete_and_everything_belonging_to_the_project_goes(
    client: TestClient, translator: Headers, reviewer: Headers, admin: Headers
) -> None:
    pid = make(client, translator)["id"]
    client.post(f"/api/projects/{pid}/translate", headers=translator)
    client.post(f"/api/projects/{pid}/approve", headers=reviewer)
    client.post(f"/api/projects/{pid}/export", headers=translator, json={"lang": "en"})
    with SessionLocal() as db:
        upload_path = Path(db.get(Project, pid).file_path)  # pyright: ignore[reportOptionalMemberAccess]
        export_path = Path(db.query(ExportFile).filter(ExportFile.project_id == pid).one().path)
    assert upload_path.exists()
    assert export_path.exists()

    assert client.delete(f"/api/projects/{pid}", headers=translator).status_code == 403
    assert client.delete(f"/api/projects/{pid}", headers=reviewer).status_code == 403
    assert client.delete(f"/api/projects/{pid}", headers=admin).status_code == 200

    assert client.get(f"/api/projects/{pid}", headers=admin).status_code == 404
    assert not upload_path.exists()
    assert not export_path.exists()  # regression: export files used to stay on disk
    with SessionLocal() as db:
        assert db.query(ExportFile).filter(ExportFile.project_id == pid).count() == 0
    assert client.delete(f"/api/projects/{pid}", headers=admin).status_code == 404
    assert settings.data_dir.exists()


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/projects/999999"),
        ("PATCH", "/api/projects/999999"),
        ("POST", "/api/projects/999999/archive"),
        ("POST", "/api/projects/999999/unarchive"),
        ("POST", "/api/projects/999999/copy"),
        ("POST", "/api/projects/999999/translate"),
        ("GET", "/api/projects/999999/status"),
        ("GET", "/api/projects/999999/original"),
        ("POST", "/api/projects/999999/reopen"),
    ],
)
def test_unknown_projects_are_404(client: TestClient, translator: Headers, method: str, path: str) -> None:
    assert client.request(method, path, headers=translator, json={} if method == "PATCH" else None).status_code == 404


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_project_endpoints_require_a_login(client: TestClient, method: str) -> None:
    assert client.request(method, "/api/projects").status_code in (401, 422)
