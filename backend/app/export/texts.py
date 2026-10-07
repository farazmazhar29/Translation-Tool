"""The fixed words of an exported document, in the language the document was translated into.

An English translation gets English headings, an English quality report and English findings; a German one
gets German. The findings are written from their `code` and `params` (see `QualityCode`), the same way the
interface does it.
"""

from app.core.enums import QualityCode, Severity
from app.quality.schemas import QualityWarning

LABELS: dict[str, dict[str, str]] = {
    "de": {
        "original": "Original",
        "translation": "Übersetzung",
        "comment": "Kommentar",
        "position": "Position",
        "page": "Seite {n}",
        "paragraph": "Absatz {n}",
        "report": "Prüfbericht",
        "no_findings": "Keine Warnungen.",
        "severity": "Schweregrad",
        "segment": "Segment",
        "type": "Typ",
        "message": "Meldung",
        "sheet": "Übersetzung",
    },
    "en": {
        "original": "Original",
        "translation": "Translation",
        "comment": "Comment",
        "position": "Position",
        "page": "Page {n}",
        "paragraph": "Paragraph {n}",
        "report": "Quality report",
        "no_findings": "No warnings.",
        "severity": "Severity",
        "segment": "Segment",
        "type": "Type",
        "message": "Message",
        "sheet": "Translation",
    },
}

SEVERITY: dict[str, dict[Severity, str]] = {
    "de": {Severity.ERROR: "Fehler", Severity.WARNING: "Warnung", Severity.INFO: "Hinweis"},
    "en": {Severity.ERROR: "Error", Severity.WARNING: "Warning", Severity.INFO: "Hint"},
}

FINDINGS: dict[str, dict[QualityCode, str]] = {
    "de": {
        QualityCode.NO_TRANSLATION: "Keine Übersetzung vorhanden.",
        QualityCode.IDENTICAL_TEXT: "Text ist identisch mit dem Original (nicht übersetzt?).",
        QualityCode.UNKNOWN_TERM: "Unbekannter/fehlerhafter Begriff: „{source}“.",
        QualityCode.AMBIGUOUS_TERM: "Mehrdeutiger Begriff „{source}“ → „{target}“ prüfen.",
        QualityCode.GLOSSARY_VIOLATION: "„{target}“ (für „{source}“) fehlt in der Übersetzung.",
        QualityCode.NUMBERS_DIFFER: "Zahlen in Original und Übersetzung unterscheiden sich.",
        QualityCode.LINE_BREAKS_DIFFER: "Anzahl der Zeilenumbrüche unterscheidet sich.",
        QualityCode.TOO_LONG: "Übersetzung ist deutlich länger als das Original (Layout prüfen).",
        QualityCode.CONTRADICTION: "Widersprüchliche Übersetzungen für „{term}“: {variants}",
        QualityCode.MISSING_GLOSSARY: "Fachbegriff „{term}“ kommt {count}× vor, fehlt aber im Glossar.",
    },
    "en": {
        QualityCode.NO_TRANSLATION: "No translation available.",
        QualityCode.IDENTICAL_TEXT: "The text is identical to the original (not translated?).",
        QualityCode.UNKNOWN_TERM: "Unknown or faulty term: “{source}”.",
        QualityCode.AMBIGUOUS_TERM: "Ambiguous term “{source}” → “{target}”: please check.",
        QualityCode.GLOSSARY_VIOLATION: "“{target}” (for “{source}”) is missing from the translation.",
        QualityCode.NUMBERS_DIFFER: "Numbers differ between the original and the translation.",
        QualityCode.LINE_BREAKS_DIFFER: "The number of line breaks differs.",
        QualityCode.TOO_LONG: "The translation is much longer than the original (check the layout).",
        QualityCode.CONTRADICTION: "Contradictory translations for “{term}”: {variants}",
        QualityCode.MISSING_GLOSSARY: "Technical term “{term}” occurs {count}× but is missing from the glossary.",
    },
}

FALLBACK = "en"  # a language without its own texts gets English, like the interface


def labels(lang: str) -> dict[str, str]:
    return LABELS.get(lang, LABELS[FALLBACK])


def severity(level: Severity, lang: str) -> str:
    return SEVERITY.get(lang, SEVERITY[FALLBACK])[level]


def finding_text(finding: QualityWarning, lang: str) -> str:
    """The sentence of a finding; findings stored before the codes existed keep their (German) message."""
    if finding.code is None:
        return finding.message
    try:
        return FINDINGS.get(lang, FINDINGS[FALLBACK])[finding.code].format_map(finding.params)
    except KeyError:  # a value is missing: better the stored message than a broken sentence
        return finding.message
