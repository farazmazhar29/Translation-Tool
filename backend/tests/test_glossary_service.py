"""Deterministic glossary matching: these rules decide what the LLM is told it MUST use."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import GlossaryEntry
from app.services import glossary as gl


@pytest.fixture
def db(client: TestClient) -> Iterator[Session]:  # the client fixture starts the app and migrates the test database
    with SessionLocal() as session:
        yield session


def add(
    db: Session,
    terms: dict[str, str],
    *,
    syn: dict[str, list[str]] | None = None,
    status: str = "approved",
    dnt: bool = False,
    category: str = "technical",
    description: str = "",
) -> None:
    db.add(
        GlossaryEntry(
            terms=terms,
            synonyms=syn or {},
            status=status,
            do_not_translate=dnt,
            category=category,
            description=description,
        )
    )
    db.commit()


# Word boundaries and inflection
@pytest.mark.parametrize("text", ["Korpus", "der korpus", "KORPUS", "Korpusse", "Korpus."])
def test_pattern_matches_inflected_and_differently_cased_forms(text: str) -> None:
    assert gl.pattern("Korpus").search(text)


@pytest.mark.parametrize("text", ["Korpuskammer", "Unterkorpus", "Korpusschrank"])
def test_pattern_does_not_match_inside_longer_words(text: str) -> None:
    assert not gl.pattern("Korpus").search(text)


def test_pattern_escapes_regex_characters_in_terms() -> None:
    assert gl.pattern("C++ (neu)").search("Der C++ (neu) Standard")
    assert not gl.pattern("a.b").search("axb")


# Matching a segment
def test_longest_term_wins_over_a_shorter_one_inside_it(db: Session) -> None:
    add(db, {"de": "Qxx Linie", "en": "Qxx line"}, category="product")
    add(db, {"de": "Qxx", "en": "Qxx short"})
    hits = gl.match_segment("Die Qxx Linie ist neu", gl.build_index(db, "de", "en"))
    assert [h.matched for h in hits] == ["Qxx Linie"]


def test_synonyms_are_found_but_report_the_main_target(db: Session) -> None:
    add(db, {"de": "Wxxblende", "en": "wxx panel"}, syn={"de": ["Wxxfront"], "en": ["wxx facing"]})
    (hit,) = gl.match_segment("Die Wxxfront ist grau", gl.build_index(db, "de", "en"))
    assert hit.matched == "Wxxfront"
    assert hit.target == "wxx panel"
    assert hit.target_forms == ["wxx panel", "wxx facing"]


def test_every_entry_is_reported_once_even_if_it_occurs_repeatedly(db: Session) -> None:
    add(db, {"de": "Yxxschrank", "en": "yxx cabinet"})
    assert len(gl.match_segment("Yxxschrank und noch ein Yxxschrank", gl.build_index(db, "de", "en"))) == 1


def test_direction_matters(db: Session) -> None:
    add(db, {"de": "Zxxplatte", "en": "zxx board"})
    assert gl.match_segment("the zxx board", gl.build_index(db, "de", "en")) == []
    (hit,) = gl.match_segment("the zxx board", gl.build_index(db, "en", "de"))
    assert hit.target == "Zxxplatte"


def test_do_not_translate_entries_keep_the_source_term(db: Session) -> None:
    add(db, {"de": "Vxx Pro"}, dnt=True, category="product", description="Produktname")
    (hit,) = gl.match_segment("Das Vxx Pro Modell", gl.build_index(db, "de", "en"))
    term = hit.term()
    assert (term.source, term.target, term.dnt) == ("Vxx Pro", "Vxx Pro", True)
    assert term.category == "protected"
    assert hit.ok_in("The Vxx Pro model")
    assert not hit.ok_in("The Vxx professional model")


def test_drafts_are_used_but_rejected_entries_are_ignored(db: Session) -> None:
    add(db, {"de": "Draftxx", "en": "draftxx en"}, status="draft")
    add(db, {"de": "Rejectxx", "en": "rejectxx en"}, status="rejected")
    index = gl.build_index(db, "de", "en")
    assert gl.match_segment("Draftxx", index)
    assert not gl.match_segment("Rejectxx", index)


def test_entries_missing_a_translation_are_skipped_unless_do_not_translate(db: Session) -> None:
    add(db, {"de": "Halbxx"})  # no English term, not a do-not-translate entry
    assert gl.match_segment("Halbxx", gl.build_index(db, "de", "en")) == []


def test_hit_conversion_lists_alternatives_without_the_chosen_target(db: Session) -> None:
    add(db, {"de": "Sxxleiste", "en": "sxx strip"}, syn={"en": ["sxx rail", "sxx trim"]}, description="Leiste")
    (hit,) = gl.match_segment("Sxxleiste", gl.build_index(db, "de", "en"))
    term = hit.term()
    assert term.category == "glossary"
    assert term.alternatives == ["sxx rail", "sxx trim"]
    assert term.description == "Leiste"
    assert hit.ok_in("a SXX RAIL")  # an approved synonym is an acceptable translation too


# Protected terms (article numbers, codes)
@pytest.mark.parametrize("code", ["AB-1234", "UK-4711/60", "SB-2200", "EN-60335", "HS-9001"])
def test_codes_with_digits_and_capitals_are_protected(code: str) -> None:
    assert gl.find_protected(f"Artikel {code} bestellen") == [code]


@pytest.mark.parametrize("text", ["12345", "Jahr 2026", "A1", "Art.-Nr.", "abc123", "Preis 49,90", "Gewicht 34,5 kg"])
def test_ordinary_numbers_and_words_are_not_protected(text: str) -> None:
    assert gl.find_protected(text) == []


def test_protected_codes_are_unique_and_ordered() -> None:
    assert gl.find_protected("UK-4711 und SB-2200 und UK-4711") == ["UK-4711", "SB-2200"]
