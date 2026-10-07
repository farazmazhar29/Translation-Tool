"""The review workflow as an API: state machine, permissions, editing rules, approval and history."""

from typing import Any

import pytest
from conftest import Headers, docx_bytes, upload
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.enums import Provider
from app.translation.router import replaced_term
from app.translation.schemas import TermReplace

BODY = "Der Korpus und die Frontblende sind weiß. Preis 49,90 EUR, Artikel UK-4711."


def segments(client: TestClient, headers: Headers, pid: int) -> list[dict[str, Any]]:
    return client.get(f"/api/projects/{pid}", headers=headers).json()["segments"]


def status_of(client: TestClient, headers: Headers, pid: int) -> str:
    return client.get(f"/api/projects/{pid}", headers=headers).json()["status"]


def post(client: TestClient, headers: Headers, pid: int, action: str, **kwargs: Any) -> int:
    return client.post(f"/api/projects/{pid}/{action}", headers=headers, **kwargs).status_code


# The state machine
def test_actions_are_only_allowed_in_the_right_state(
    client: TestClient, translator: Headers, reviewer: Headers
) -> None:
    pid = upload(client, translator, "sm.docx", docx_bytes("Montage", BODY))["id"]
    assert status_of(client, translator, pid) == "new"
    assert post(client, reviewer, pid, "approve") == 409  # nothing to review yet
    assert post(client, translator, pid, "export", json={"lang": "en", "format": "docx"}) == 409

    assert post(client, translator, pid, "translate") == 200
    assert status_of(client, translator, pid) == "preview_ready"

    assert post(client, translator, pid, "approve") == 403  # translators cannot approve
    assert post(client, reviewer, pid, "approve") == 200
    assert status_of(client, translator, pid) == "approved"

    # once approved the content is frozen
    for action in ("approve", "translate"):
        assert post(client, reviewer, pid, action) == 409, action
    sid = segments(client, translator, pid)[0]["id"]
    assert client.put(f"/api/segments/{sid}/en", headers=translator, json={"text": "x"}).status_code == 409
    assert client.post(f"/api/segments/{sid}/en/retranslate", headers=translator).status_code == 409
    assert post(client, translator, pid, "replace-term", json={"lang": "en", "old": "a", "new": "b"}) == 409

    # reopening makes it editable again
    assert post(client, translator, pid, "reopen") == 200
    assert status_of(client, translator, pid) == "preview_ready"
    assert client.put(f"/api/segments/{sid}/en", headers=translator, json={"comment": "again"}).status_code == 200


def test_reviewers_may_approve_straight_from_preview(
    client: TestClient, reviewer: Headers, translated_project: int
) -> None:
    assert post(client, reviewer, translated_project, "approve") == 200


def test_approval_needs_a_translation_for_every_segment(
    client: TestClient, translator: Headers, reviewer: Headers
) -> None:
    pid = upload(client, translator, "u.docx", docx_bytes("Montage", BODY))["id"]
    client.put(f"/api/projects/{pid}/../{pid}", headers=translator)  # no-op, keeps the project untouched
    assert post(client, reviewer, pid, "approve") == 409  # never translated (status new)
    post(client, translator, pid, "translate")
    sid = segments(client, translator, pid)[0]["id"]
    client.put(f"/api/segments/{sid}/en", headers=translator, json={"text": "   "})  # a reviewer sees an empty segment
    r = client.post(f"/api/projects/{pid}/approve", headers=reviewer)
    assert r.status_code == 400
    assert (r.json()["code"], r.json()["params"]) == ("segments_untranslated", {"segments": "1"})
    assert r.json()["detail"] == "Segment(s) 1 have no translation"


# Editing rules
def test_editing_recomputes_glossary_compliance(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    seg = segments(client, translator, translated_project)[1]
    machine = seg["translations"]["en"]["text"]
    assert "carcass" in machine

    broken = client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"text": "The body is white"}).json()
    tr = broken["translations"]["en"]
    assert (tr["edited"], tr["edited_by"]) == (True, "translator")
    assert {t["source"]: t["ok"] for t in tr["terms"]}["Korpus"] is False

    fixed = client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"text": machine}).json()
    tr = fixed["translations"]["en"]
    assert tr["edited"] is False  # back to the machine output
    assert {t["source"]: t["ok"] for t in tr["terms"]}["Korpus"] is True


def test_a_comment_alone_is_not_an_edit(client: TestClient, translator: Headers, translated_project: int) -> None:
    seg = segments(client, translator, translated_project)[1]
    r = client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"comment": "Bitte prüfen"}).json()
    tr = r["translations"]["en"]
    assert tr["comment"] == "Bitte prüfen"
    assert tr["edited"] is False
    assert tr["text"] == seg["translations"]["en"]["text"]


def test_unknown_segments_are_404(client: TestClient, translator: Headers) -> None:
    assert client.put("/api/segments/999999/en", headers=translator, json={"text": "x"}).status_code == 404
    assert client.post("/api/segments/999999/en/retranslate", headers=translator).status_code == 404


def test_editing_a_new_language_creates_its_translation(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    sid = segments(client, translator, translated_project)[0]["id"]
    r = client.put(f"/api/segments/{sid}/de", headers=translator, json={"text": "Hand geschrieben"}).json()
    assert r["translations"]["de"]["text"] == "Hand geschrieben"


def test_regenerating_a_segment_restores_the_machine_translation(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    seg = segments(client, translator, translated_project)[1]
    client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"text": "garbage"})
    r = client.post(f"/api/segments/{seg['id']}/en/retranslate", headers=translator).json()
    assert r["translations"]["en"]["text"] == seg["translations"]["en"]["text"]
    assert r["translations"]["en"]["edited"] is False


def test_regeneration_reports_provider_problems_as_502(
    client: TestClient, translator: Headers, translated_project: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    sid = segments(client, translator, translated_project)[0]["id"]
    monkeypatch.setattr(settings, "llm_provider", Provider.GEMINI)  # no key in the test environment
    r = client.post(f"/api/segments/{sid}/en/retranslate", headers=translator)
    assert r.status_code == 502
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_replacing_a_term_changes_every_segment_and_marks_them_edited(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    r = client.post(
        f"/api/projects/{translated_project}/replace-term",
        headers=translator,
        json={"lang": "en", "old": "CARCASS", "new": "shell"},
    )
    assert r.json() == {"replaced_in_segments": 1}  # case-insensitive
    tr = segments(client, translator, translated_project)[1]["translations"]["en"]
    assert "shell" in tr["text"]
    assert "carcass" not in tr["text"]
    assert tr["edited"] is True
    assert {t["source"]: t["target"] for t in tr["terms"]}["Korpus"] == "shell"
    again = client.post(
        f"/api/projects/{translated_project}/replace-term",
        headers=translator,
        json={"lang": "en", "old": "nothing-here", "new": "x"},
    )
    assert again.json() == {"replaced_in_segments": 0}


def test_a_judgment_call_can_be_accepted_and_reopened_but_an_error_cannot(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    first, second = segments(client, translator, translated_project)[:2]
    client.put(f"/api/segments/{first['id']}/en", headers=translator, json={"text": "Assembly\ninstructions"})
    client.put(f"/api/segments/{second['id']}/en", headers=translator, json={"text": "   "})
    url = f"/api/projects/{translated_project}/quality"

    def finding(code: str) -> dict[str, Any]:
        return next(w for w in client.get(url, headers=translator).json()["warnings"] if w["code"] == code)

    breaks, missing = finding("line_breaks_differ"), finding("no_translation")
    accepted = client.put(f"{url}/accepted", headers=translator, json={"keys": [breaks["key"]]})
    assert accepted.json() == [breaks["key"]]
    assert finding("line_breaks_differ")["accepted"] is True  # remembered on the next check
    assert client.put(f"{url}/accepted", headers=translator, json={"keys": [missing["key"]]}).status_code == 400
    client.put(f"{url}/accepted", headers=translator, json={"keys": []})  # reopen all
    assert finding("line_breaks_differ")["accepted"] is False


def test_replacing_keeps_a_capital_letter_at_the_start_of_a_sentence(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    sid = segments(client, translator, translated_project)[1]["id"]
    client.put(f"/api/segments/{sid}/en", headers=translator, json={"text": "Wall units hang. Two wall units."})
    client.post(
        f"/api/projects/{translated_project}/replace-term",
        headers=translator,
        json={"lang": "en", "old": "wall units", "new": "wall cabinets"},
    )
    text = segments(client, translator, translated_project)[1]["translations"]["en"]["text"]
    assert text == "Wall cabinets hang. Two wall cabinets."


def test_a_term_can_be_replaced_in_one_segment_and_its_stored_translation_follows(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    first, second = segments(client, translator, translated_project)[:2]
    client.put(f"/api/segments/{first['id']}/en", headers=translator, json={"text": "The carcass first."})
    url = f"/api/projects/{translated_project}/replace-term"

    def replace(old: str, new: str, sid: int = second["id"]) -> int:
        body = {"lang": "en", "old": old, "new": new, "segment_id": sid, "source": "Korpus"}
        r = client.post(url, headers=translator, json=body)
        return r.json()["replaced_in_segments"] if r.status_code == 200 else r.status_code

    def state() -> tuple[str, str]:
        tr = segments(client, translator, translated_project)[1]["translations"]["en"]
        return tr["text"], {t["source"]: t["target"] for t in tr["terms"]}["Korpus"]

    assert replace("carcass", "carcasss") == 1  # a typo, in this segment only
    assert state()[0].startswith("The carcasss and")
    assert state()[1] == "carcasss"
    assert segments(client, translator, translated_project)[0]["translations"]["en"]["text"] == "The carcass first."
    assert replace("carcasss", "carcass") == 1  # ... and it can be undone, because the term followed
    assert state()[1] == "carcass"
    # an older edit left the term behind ("carcass" stored, "carcassll" in the text): the source still finds it
    text = state()[0].replace("carcass", "carcassll")
    client.put(f"/api/segments/{second['id']}/en", headers=translator, json={"text": text})
    assert replace("carcassll", "carcass") == 1
    assert state()[0].startswith("The carcass and")
    assert replace("nothing-here", "x") == 0
    assert replace("carcass", "x", sid=999_999) == 404


def test_choosing_an_alternative_keeps_the_old_translation_as_one() -> None:
    term = {"source": "Korpus", "target": "carcass", "alternatives": ["cabinet body", "shell"], "ok": True}
    body = TermReplace(lang="en", old="carcass", new="cabinet body")
    assert replaced_term(term, body)["alternatives"] == ["carcass", "shell"]
    other = {**term, "source": "Front", "target": "front"}
    assert replaced_term(other, body) is other


# Quality, approval and history
def test_quality_endpoint_reports_the_glossary_version(
    client: TestClient, translator: Headers, translated_project: int
) -> None:
    q = client.get(f"/api/projects/{translated_project}/quality", headers=translator).json()
    assert q["errors"] == 0
    assert q["glossary_version"] >= 1
    assert (
        client.get(f"/api/projects/{translated_project}/quality", headers=translator, params={"lang": "xx"}).json()[
            "warnings"
        ][0]["type"]
        == "untranslated"
    )
    assert client.get("/api/projects/999999/quality", headers=translator).status_code == 404


def test_approval_stores_an_immutable_release_with_preview_and_final_text(
    client: TestClient, translator: Headers, reviewer: Headers, translated_project: int
) -> None:
    pid = translated_project
    seg = segments(client, translator, pid)[1]
    machine = seg["translations"]["en"]["text"]
    client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"text": "Edited by hand"})
    post(client, reviewer, pid, "approve")

    history = client.get(f"/api/projects/{pid}/history", headers=translator).json()
    (release,) = history["releases"]
    assert release["approved_by"] == "reviewer"
    assert release["change_count"] == 1
    assert "translator" in release["editors"]
    assert release["glossary_version"] >= 1

    detail = client.get(f"/api/releases/{release['id']}", headers=translator).json()
    assert detail["preview"][str(seg["id"])]["en"] == machine  # what the machine produced
    assert detail["final"][str(seg["id"])]["en"] == "Edited by hand"  # what was approved
    assert any(w["type"] == "glossary_violation" for w in detail["warnings"])  # the edit dropped the glossary term

    # the release stays as approved even if the project is edited afterwards
    post(client, translator, pid, "reopen")
    client.put(f"/api/segments/{seg['id']}/en", headers=translator, json={"text": "Changed later"})
    assert (
        client.get(f"/api/releases/{release['id']}", headers=translator).json()["final"][str(seg["id"])]["en"]
        == "Edited by hand"
    )


def test_every_approval_creates_a_new_release(
    client: TestClient, translator: Headers, reviewer: Headers, translated_project: int
) -> None:
    pid = translated_project
    post(client, reviewer, pid, "approve")
    post(client, translator, pid, "reopen")
    post(client, reviewer, pid, "approve")
    assert len(client.get(f"/api/projects/{pid}/history", headers=translator).json()["releases"]) == 2


def test_unknown_release_and_history_are_404(client: TestClient, translator: Headers) -> None:
    assert client.get("/api/releases/999999", headers=translator).status_code == 404
    assert client.get("/api/projects/999999/history", headers=translator).status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/releases/1"),
        ("GET", "/api/projects/1/history"),
        ("POST", "/api/projects/1/approve"),
        ("GET", "/api/dashboard"),
    ],
)
def test_workflow_endpoints_require_a_login(client: TestClient, method: str, path: str) -> None:
    assert client.request(method, path).status_code == 401
