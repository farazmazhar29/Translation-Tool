"""Translation pipeline: language detection, term post-verification, failure handling, restart recovery."""

import time
from collections.abc import Iterator

import pytest
from conftest import Headers, docx_bytes, upload
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.enums import JobState, Provider, TermCategory
from app.main import recover_interrupted_jobs
from app.projects.language import detect_language
from app.projects.models import Project, Segment
from app.translation.llm import LLMProvider, LLMResult, LLMSegment, LLMTerm
from app.translation.pipeline import translate_segments


class FixedProvider(LLMProvider):
    """Returns a prepared answer, so the post-verification can be tested without any real model."""

    def __init__(self, translation: str, terms: list[LLMTerm] | None = None) -> None:
        self.translation, self.terms = translation, terms or []

    def translate_batch(self, src: str, tgt: str, segments: list[LLMSegment]) -> list[LLMResult]:  # noqa: ARG002
        return [LLMResult(id=s.id, translation=self.translation, terms=self.terms) for s in segments]


@pytest.fixture
def db(client: TestClient) -> Iterator[Session]:  # the client fixture starts the app and migrates the test database
    with SessionLocal() as session:
        yield session


# Language detection
@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Der Korpus ist nicht mit der Arbeitsplatte verbunden und die Tür wird montiert.", "de"),
        ("The carcass is not attached to the worktop and the door will be mounted by the installer.", "en"),
        ("OK", ""),  # too little evidence
        ("Korpus Frontblende Scharnier", ""),  # nouns only: no stop words
        ("Le corps est blanc et la porte est montée avec les charnières", ""),  # a language we do not support
        ("", ""),
    ],
)
def test_detect_language(text: str, expected: str) -> None:
    assert detect_language([text]) == expected


def test_detection_uses_all_segments_together() -> None:
    assert detect_language(["Der Korpus", "ist weiß und die Tür", "wird mit dem Griff montiert"]) == "de"


# Post-verification of glossary terms
def segments_of(db: Session, pid: int) -> list[Segment]:
    return list(db.get(Project, pid).segments)  # pyright: ignore[reportOptionalMemberAccess]


def test_a_translation_that_ignores_the_glossary_is_flagged(
    client: TestClient, translator: Headers, db: Session
) -> None:
    pid = upload(client, translator, "g.docx", docx_bytes("Der Korpus ist weiß und die Tür ist neu."))["id"]
    segs = segments_of(db, pid)
    translate_segments(db, segs, "de", "en", FixedProvider("The body is white and the door is new."))
    terms = {t["source"]: t for t in segs[0].translations[0].terms}
    assert terms["Korpus"]["ok"] is False  # glossary says "carcass"
    translate_segments(db, segs, "de", "en", FixedProvider("The carcass is white and the door is new."))
    assert {t["source"]: t["ok"] for t in segs[0].translations[0].terms}["Korpus"] is True


def test_codes_are_detected_even_if_the_model_does_not_report_them(
    client: TestClient, translator: Headers, db: Session
) -> None:
    pid = upload(client, translator, "c.docx", docx_bytes("Bestellen Sie Artikel UK-4711/60 bitte jetzt."))["id"]
    segs = segments_of(db, pid)
    translate_segments(db, segs, "de", "en", FixedProvider("Please order article UK-4711/60 now."))
    (code,) = (t for t in segs[0].translations[0].terms if t["category"] == "protected")
    assert (code["source"], code["ok"], code["dnt"]) == ("UK-4711/60", True, True)
    translate_segments(db, segs, "de", "en", FixedProvider("Please order the article now."))
    (code,) = (t for t in segs[0].translations[0].terms if t["category"] == "protected")
    assert code["ok"] is False  # the code disappeared from the translation


def test_model_terms_are_added_but_never_duplicate_glossary_terms(
    client: TestClient, translator: Headers, db: Session
) -> None:
    pid = upload(client, translator, "m.docx", docx_bytes("Der Korpus hat eine Spanplatte als Material."))["id"]
    segs = segments_of(db, pid)
    reported = [
        LLMTerm(source="Korpus", target="carcass", category=TermCategory.TECHNICAL),  # already a glossary term
        LLMTerm(source="Spanplatte", target="chipboard", category=TermCategory.TECHNICAL, description="Holzwerkstoff"),
    ]
    translate_segments(db, segs, "de", "en", FixedProvider("The carcass has chipboard as material.", reported))
    by_category = {(t["source"], t["category"]) for t in segs[0].translations[0].terms}
    assert ("Korpus", "glossary") in by_category
    assert ("Korpus", "technical") not in by_category
    assert ("Spanplatte", "technical") in by_category


def test_retranslating_replaces_manual_edits(client: TestClient, translator: Headers, db: Session) -> None:
    pid = upload(client, translator, "r.docx", docx_bytes("Der Korpus ist weiß und die Tür ist neu."))["id"]
    segs = segments_of(db, pid)
    translate_segments(db, segs, "de", "en", FixedProvider("The carcass is white and the door is new."))
    tr = segs[0].translations[0]
    tr.text, tr.edited, tr.edited_by = "hand edited", True, "translator"
    translate_segments(db, segs, "de", "en", FixedProvider("The carcass is white again."))
    assert (tr.text, tr.edited, tr.edited_by) == ("The carcass is white again.", False, "")
    assert len(segs[0].translations) == 1  # updated in place, not duplicated


def test_progress_is_reported_per_batch(
    client: TestClient, translator: Headers, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "batch_size", 2)
    pid = upload(
        client, translator, "p.docx", docx_bytes(*[f"Der Korpus Nummer {i} ist gut genug." for i in range(5)])
    )["id"]
    seen: list[int] = []
    translate_segments(db, segments_of(db, pid), "de", "en", FixedProvider("ok"), progress=seen.append)
    assert seen == [2, 4, 5]


# Failure handling of the background job
def wait_for_job(client: TestClient, headers: Headers, pid: int) -> dict[str, object]:
    for _ in range(100):
        status = client.get(f"/api/projects/{pid}/status", headers=headers).json()
        if status["job_state"] != "running":
            return status
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def test_undetectable_language_asks_the_user_to_choose(client: TestClient, translator: Headers) -> None:
    project = upload(client, translator, "n.docx", docx_bytes("Korpus Frontblende Scharnier Sockelblende"))
    assert project["target_langs"] == []  # no target while the source is unknown
    r = client.post(f"/api/projects/{project['id']}/translate", headers=translator)
    assert r.status_code == 400
    assert "Ausgangssprache" in r.json()["detail"]
    # choosing the language manually fixes it, and the other language becomes the target
    r = client.post(f"/api/projects/{project['id']}/translate", headers=translator, json={"source_lang": "de"})
    assert (r.status_code, r.json()["target_langs"]) == (200, ["en"])
    assert wait_for_job(client, translator, project["id"])["job_state"] == "done"


def test_provider_errors_are_shown_to_the_user(
    client: TestClient, translator: Headers, translated_project: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "llm_provider", Provider.GEMINI)  # no API key configured in tests
    assert client.post(f"/api/projects/{translated_project}/translate", headers=translator).status_code == 200
    status = wait_for_job(client, translator, translated_project)
    assert status["job_state"] == "error"
    assert "GEMINI_API_KEY" in str(status["job_error"])


def test_a_second_translation_cannot_start_while_one_is_running(
    client: TestClient, translator: Headers, db: Session, translated_project: int
) -> None:
    db.get(Project, translated_project).job_state = JobState.RUNNING  # pyright: ignore[reportOptionalMemberAccess]
    db.commit()
    assert client.post(f"/api/projects/{translated_project}/translate", headers=translator).status_code == 409


def test_the_target_is_always_the_other_language(client: TestClient, translator: Headers) -> None:
    german = upload(client, translator, "de.docx", docx_bytes("Der Korpus ist aus Eiche und die Front ist weiß."))
    assert (german["detected_lang"], german["target_langs"]) == ("de", ["en"])
    english = upload(client, translator, "en.docx", docx_bytes("The carcass is made of oak and the front is white."))
    assert (english["detected_lang"], english["target_langs"]) == ("en", ["de"])
    # a target list sent by an older client is ignored
    r = client.post(f"/api/projects/{german['id']}/translate", headers=translator, json={"target_langs": ["de", "en"]})
    assert r.json()["target_langs"] == ["en"]


def test_a_restart_marks_interrupted_jobs_as_failed(
    client: TestClient, translator: Headers, db: Session, translated_project: int
) -> None:
    project = db.get(Project, translated_project)
    assert project is not None
    project.job_state, project.job_error = JobState.RUNNING, ""
    db.commit()
    recover_interrupted_jobs()
    status = client.get(f"/api/projects/{translated_project}/status", headers=translator).json()
    assert status["job_state"] == "error"
    assert "neu gestartet" in status["job_error"]
