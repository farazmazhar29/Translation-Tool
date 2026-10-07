"""Quality check: pure logic, tested on in-memory objects (a throw-away database only for the glossary)."""

from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.db import Base
from app.glossary.models import GlossaryEntry
from app.glossary.schemas import Term
from app.projects.models import Project, Segment, Translation
from app.quality.schemas import QualityWarning
from app.quality.service import check_project


def term(source: str, target: str, category: str = "technical", **over: Any) -> dict[str, Any]:
    return Term.model_validate({"source": source, "target": target, "category": category, **over}).model_dump()


def project(*rows: tuple[str, str | None, list[dict[str, Any]]], langs: tuple[str, ...] = ("en",)) -> Project:
    """Each row is (source text, translation or None for 'not translated', terms)."""
    p = Project(name="p", source_lang="de", target_langs=list(langs), segments=[])
    for i, (source, translated, terms) in enumerate(rows):
        seg = Segment(id=i + 1, idx=i, locator={}, source_text=source)
        if translated is not None:
            seg.translations.append(Translation(lang=langs[0], text=translated, original_text=translated, terms=terms))
        p.segments.append(seg)
    return p


def kinds(warnings: list[QualityWarning]) -> list[str]:
    return [w.type for w in warnings]


def test_a_clean_translation_has_no_warnings() -> None:
    p = project(("Der Korpus ist weiß.", "The carcass is white.", [term("Korpus", "carcass", "glossary")]))
    assert check_project(p) == []


def test_missing_translation_is_an_error() -> None:
    (w,) = check_project(project(("Hallo Welt", None, [])))
    assert (w.type, w.severity, w.segment_id) == ("untranslated", "error", 1)


def test_empty_translation_text_counts_as_missing() -> None:
    assert kinds(check_project(project(("Hallo Welt", "   ", [])))) == ["untranslated"]


def test_text_identical_to_the_original_is_flagged_unless_it_is_a_code() -> None:
    assert kinds(check_project(project(("Das ist ein Satz", "Das ist ein Satz", [])))) == ["untranslated"]
    code = term("UK-4711", "UK-4711", "protected", dnt=True)
    assert check_project(project(("UK-4711 UK-4711 UK-4711", "UK-4711 UK-4711 UK-4711", [code]))) == []
    assert check_project(project(("Hallo", "Hallo", []))) == []  # one or two words may legitimately stay


def test_glossary_violation_is_an_error_naming_the_missing_term() -> None:
    p = project(("Der Korpus", "The body", [term("Korpus", "carcass", "glossary", ok=False)]))
    (w,) = check_project(p)
    assert (w.type, w.severity) == ("glossary_violation", "error")
    assert "carcass" in w.message
    assert "Korpus" in w.message


def test_protected_term_missing_is_also_an_error() -> None:
    p = project(("Art. UK-ABCD", "Item", [term("UK-ABCD", "UK-ABCD", "protected", ok=False)]))
    assert kinds(check_project(p)) == ["glossary_violation"]


def test_unknown_and_ambiguous_terms_are_reported_with_the_right_severity() -> None:
    p = project(
        (
            "Zwirbel und Platte",
            "Zwirbel and board",
            [term("Zwirbel", "Zwirbel", "unknown"), term("Platte", "board", "ambiguous")],
        )
    )
    by_type = {w.type: w.severity for w in check_project(p)}
    assert by_type == {"unknown_term": "warning", "ambiguous_term": "info"}


def test_numbers_must_match_between_original_and_translation() -> None:
    assert kinds(check_project(project(("Preis 49,90 EUR", "Price 49.90 EUR", [])))) == []  # decimal comma is fine
    assert kinds(check_project(project(("Preis 49,90 EUR", "Price 94.90 EUR", [])))) == ["formatting"]
    assert kinds(check_project(project(("Maße 60 x 80", "Dimensions 60", [])))) == ["formatting"]


def test_line_breaks_and_extreme_length_are_noted() -> None:
    warnings = check_project(project(("Zeile eins\nZeile zwei", "Line one Line two", [])))
    assert [(w.type, w.severity) for w in warnings] == [("formatting", "info")]
    long = "x" * 200
    assert any("much longer" in w.message for w in check_project(project(("Kurz", long, []))))


def test_contradicting_translations_of_the_same_term_are_found() -> None:
    p = project(
        ("Der Auszug klemmt", "The pull-out sticks", [term("Auszug", "pull-out")]),
        ("Der Auszug fehlt", "The drawer is missing", [term("Auszug", "drawer")]),
    )
    (w,) = (w for w in check_project(p) if w.type == "contradiction")
    assert '"Auszug"' in w.message  # as written in the text
    assert "pull-out" in w.message
    assert "drawer" in w.message
    assert w.segment_id is None


def test_a_term_used_consistently_is_not_a_contradiction() -> None:
    p = project(
        ("Der Auszug klemmt", "The pull-out sticks", [term("Auszug", "pull-out")]),
        ("Der Auszug fehlt", "The pull-out is missing", [term("Auszug", "pull-out")]),
    )
    assert "contradiction" not in kinds(check_project(p))


def test_singular_and_plural_are_the_same_translation() -> None:
    """German "Schrankaufhänger" is singular and plural; English needs both forms, which is no contradiction."""
    p = project(
        ("Schrankaufhänger, verstellbar", "Cabinet hanger, adjustable", [term("Schrankaufhänger", "cabinet hanger")]),
        ("Schrankaufhänger paarweise", "Cabinet hangers in pairs", [term("Schrankaufhänger", "cabinet hangers")]),
    )
    assert "contradiction" not in kinds(check_project(p))


def test_a_suggested_glossary_entry_drops_the_capital_of_a_sentence_start() -> None:
    def suggestion(target: str) -> str:
        row = ("Stahl vernickelt", f"{target} steel", [term("vernickelt", target)])
        (w,) = check_project(project(row, row))
        return w.params["target"]

    assert suggestion("Nickel-plated") == "nickel-plated"
    assert suggestion("LED lighting") == "LED lighting"  # an abbreviation keeps its capitals


def test_frequent_terms_missing_from_the_glossary_are_suggested() -> None:
    row = ("Das Scharnier", "The hinge", [term("Scharnier", "hinge")])
    assert kinds(check_project(project(row))) == []  # once is not worth a suggestion
    (w,) = check_project(project(row, row))
    assert (w.type, w.severity) == ("missing_glossary", "info")
    assert "2×" in w.message


def test_terms_that_are_already_in_the_glossary_are_not_suggested() -> None:
    row = ("Der Korpus", "The carcass", [term("Korpus", "carcass", "glossary", glossary_id=3)])
    assert check_project(project(row, row, row)) == []


def test_warnings_are_sorted_errors_first_then_by_position() -> None:
    p = project(
        ("Preis 5", "Price 6", []),  # warning (numbers)
        ("Hallo", None, []),  # error
        ("Zeile\neins", "Line one", []),  # info
    )
    assert [(w.severity, w.idx) for w in check_project(p)] == [("error", 1), ("warning", 0), ("info", 2)]


def test_checking_a_single_language_ignores_the_others() -> None:
    p = project(("Hallo Welt", "Hello world", []), langs=("en", "de"))
    assert check_project(p, "en") == []
    assert kinds(check_project(p, "de")) == ["untranslated"]
    assert check_project(p) == []  # by default the real targets: German is the source here, not a target


# Codes and values: the interface writes each sentence in the language of the user
def codes(warnings: list[QualityWarning]) -> list[str]:
    return [str(w.code) for w in warnings]


def test_every_finding_carries_a_code_and_the_values_for_its_sentence() -> None:
    p = project(
        ("Der Korpus", "The body", [term("Korpus", "carcass", "glossary", ok=False)]),
        ("Das ist ein Satz", "Das ist ein Satz", [term("Qxx", "Qxx", "unknown")]),
        ("Maße 60 x 80", "Dimensions 60", [term("Zarge", "frame", "ambiguous")]),
    )
    found = {str(w.code): w for w in check_project(p)}
    assert set(found) == {"glossary_violation", "identical_text", "unknown_term", "numbers_differ", "ambiguous_term"}
    assert found["glossary_violation"].params == {"source": "Korpus", "target": "carcass"}
    assert found["unknown_term"].params["source"] == "Qxx"
    assert found["ambiguous_term"].params == {"source": "Zarge", "target": "frame"}
    assert found["numbers_differ"].params == {}  # a sentence without values


def test_no_translation_and_the_length_and_line_break_notes_have_codes() -> None:
    assert codes(check_project(project(("Hallo Welt", None, [])))) == ["no_translation"]
    assert codes(check_project(project(("a", "a very very very very very very long translation", [])))) == ["too_long"]
    assert codes(check_project(project(("Zeile 1\nZeile 2", "Line 1 Line 2", [])))) == ["line_breaks_differ"]


def test_contradictions_and_missing_glossary_terms_name_their_values() -> None:
    p = project(
        ("Der Korpus", "The body", [term("Korpus", "body")]),
        ("Ein Korpus", "A carcass", [term("Korpus", "carcass")]),
    )
    found = {str(w.code): w for w in check_project(p)}
    assert found["contradiction"].params["term"] == "Korpus"
    assert '"body"' in found["contradiction"].params["variants"]
    assert found["contradiction"].params["options"] == "body|carcass"  # what the interface offers to unify on
    # the translation used first is offered when the term is added to the glossary
    assert found["missing_glossary"].params == {"term": "Korpus", "count": "2", "target": "body"}


def test_findings_that_were_stored_without_a_code_still_load() -> None:
    old = {"segment_id": 1, "idx": 0, "lang": "en", "type": "formatting", "severity": "info", "message": "Alt"}
    w = QualityWarning.model_validate(old)
    assert w.code is None
    assert w.params == {}


# The current glossary counts, not only the term categories stored at translation time
def glossary(*entries: tuple[str, str]) -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = Session(engine)
    db.add_all(GlossaryEntry(terms={"de": de, "en": en}) for de, en in entries)
    db.commit()
    return db


def test_a_term_added_to_the_glossary_after_the_translation_is_no_longer_missing() -> None:
    row = ("Aus Kunststoff", "Made of plastic", [term("Kunststoff", "plastic")])
    assert codes(check_project(project(row, row))) == ["missing_glossary"]  # without the glossary
    assert check_project(project(row, row), db=glossary(("Kunststoff", "plastic"))) == []


def test_the_glossary_confirms_an_ambiguous_translation() -> None:
    row = ("Stand: Oktober", "Status: October", [term("Stand", "Status", "ambiguous")])
    assert codes(check_project(project(row))) == ["ambiguous_term"]
    assert check_project(project(row), db=glossary(("Stand", "status"))) == []  # the glossary says it is right


def test_a_translation_that_the_glossary_contradicts_is_an_error() -> None:
    row = ("Aus Kunststoff", "Made of plastic", [term("Kunststoff", "plastic")])
    (w,) = check_project(project(row), db=glossary(("Kunststoff", "synthetic material")))
    assert (w.code, w.severity, w.params["target"]) == ("glossary_violation", "error", "synthetic material")


def test_accepted_findings_are_marked_and_listed_last_but_errors_cannot_be_accepted() -> None:
    p = project(("Kurz", "x" * 80, []), ("Hallo Welt", None, []))
    too_long, missing = sorted(check_project(p), key=lambda w: w.severity != "info")
    p.accepted_findings = [too_long.key, missing.key]
    first, last = check_project(p)
    assert (first.code, first.accepted) == ("no_translation", False)  # an error stays open
    assert (last.code, last.accepted) == ("too_long", True)
