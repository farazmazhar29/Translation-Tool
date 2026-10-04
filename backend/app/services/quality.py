"""Quality check before approval. It only warns; the reviewer decides."""

import re
from collections import defaultdict

from ..enums import Severity, TermCategory
from ..models import Project, Segment
from ..schemas import QualityWarning, Term

ORDER = {Severity.ERROR: 0, Severity.WARNING: 1, Severity.INFO: 2}


def _numbers(s: str) -> list[str]:
    return sorted(n.replace(",", ".") for n in re.findall(r"\d+(?:[.,]\d+)?", s))


def check_project(p: Project, lang: str | None = None) -> list[QualityWarning]:
    out: list[QualityWarning] = []
    for tgt in [lang] if lang else p.targets:

        def warn(idx: int, seg_id: int | None, kind: str, sev: Severity, msg: str, tgt: str = tgt) -> None:
            out.append(QualityWarning(segment_id=seg_id, idx=idx, lang=tgt, type=kind, severity=sev, message=msg))

        variants: dict[str, dict[str, int]] = defaultdict(dict)  # source term -> {translation: first segment idx}
        unlisted: dict[str, int] = defaultdict(int)
        for seg in p.segments:
            tr = seg.translation(tgt)

            def w(kind: str, sev: Severity, msg: str, seg: Segment = seg) -> None:
                warn(seg.idx, seg.id, kind, sev, msg)

            if tr is None or not tr.text.strip():
                w("untranslated", Severity.ERROR, "Keine Übersetzung vorhanden.")
                continue
            terms = [Term.model_validate(t) for t in tr.terms]
            if (
                tr.text.strip().lower() == seg.source_text.strip().lower()
                and len(seg.source_text.split()) > 2
                and not (
                    terms and all(t.category == TermCategory.PROTECTED for t in terms)
                )  # only codes: may stay as is
            ):
                w("untranslated", Severity.WARNING, "Text ist identisch mit dem Original (nicht übersetzt?).")
            for t in terms:
                if t.category == TermCategory.UNKNOWN:
                    w("unknown_term", Severity.WARNING, f"Unbekannter/fehlerhafter Begriff: „{t.source}“.")
                elif t.category == TermCategory.AMBIGUOUS:
                    w("ambiguous_term", Severity.INFO, f"Mehrdeutiger Begriff „{t.source}“ → „{t.target}“ prüfen.")
                elif t.category in (TermCategory.GLOSSARY, TermCategory.PROTECTED) and not t.ok:
                    w(
                        "glossary_violation",
                        Severity.ERROR,
                        f"„{t.target}“ (für „{t.source}“) fehlt in der Übersetzung.",
                    )
                elif t.category == TermCategory.TECHNICAL:
                    variants[t.source.lower()].setdefault(t.target.lower(), seg.idx)
                    unlisted[t.source.lower()] += 1
            if _numbers(seg.source_text) != _numbers(tr.text):
                w("formatting", Severity.WARNING, "Zahlen in Original und Übersetzung unterscheiden sich.")
            if seg.source_text.count("\n") != tr.text.count("\n"):
                w("formatting", Severity.INFO, "Anzahl der Zeilenumbrüche unterscheidet sich.")
            if len(tr.text) > 2.5 * len(seg.source_text) + 20:
                w("formatting", Severity.INFO, "Übersetzung ist deutlich länger als das Original (Layout prüfen).")
        for term, vs in variants.items():
            if len(vs) > 1:
                warn(
                    min(vs.values()),
                    None,
                    "contradiction",
                    Severity.WARNING,
                    f"Widersprüchliche Übersetzungen für „{term}“: " + " / ".join(f"„{v}“" for v in vs),
                )
        for term, n in unlisted.items():
            if n >= 2:
                warn(
                    -1,
                    None,
                    "missing_glossary",
                    Severity.INFO,
                    f"Fachbegriff „{term}“ kommt {n}× vor, fehlt aber im Glossar.",
                )
    return sorted(out, key=lambda x: (ORDER[x.severity], x.idx))
