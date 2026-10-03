"""Quality check: pure logic, tested on in-memory objects (no database needed)."""

from typing import Any

from app.models import Project, Segment, Translation
from app.schemas import QualityWarning, Term
from app.services.quality import check_project


def term(source: str, target: str, category: str = "technical", **over: Any) -> dict[str, Any]:
    return Term.model_validate({"source": source, "target": target, "category": category, **over}).model_dump()


def project(*rows: tuple[str, str | None, list[dict[str, Any]]], langs: tuple[str, ...] = ("en",)) -> Project:
    """Each row is (source text, translation or None for 'not translated', terms)."""
    p = Project(name="p", target_langs=list(langs), segments=[])
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
    assert any("länger" in w.message for w in check_project(project(("Kurz", long, []))))


def test_contradicting_translations_of_the_same_term_are_found() -> None:
    p = project(
        ("Der Auszug klemmt", "The pull-out sticks", [term("Auszug", "pull-out")]),
        ("Der Auszug fehlt", "The drawer is missing", [term("Auszug", "drawer")]),
    )
    (w,) = (w for w in check_project(p) if w.type == "contradiction")
    assert "„auszug“" in w.message
    assert "pull-out" in w.message
    assert "drawer" in w.message
    assert w.segment_id is None


def test_a_term_used_consistently_is_not_a_contradiction() -> None:
    p = project(
        ("Der Auszug klemmt", "The pull-out sticks", [term("Auszug", "pull-out")]),
        ("Der Auszug fehlt", "The pull-out is missing", [term("Auszug", "pull-out")]),
    )
    assert "contradiction" not in kinds(check_project(p))


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
    assert kinds(check_project(p)) == ["untranslated"]  # all target languages by default
