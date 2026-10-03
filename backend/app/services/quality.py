"""Quality check before approval. It only warns; the reviewer decides."""

import re
from collections import defaultdict

from ..models import Project, Segment
from ..schemas import Severity, Term, Warning

ORDER: dict[Severity, int] = {"error": 0, "warning": 1, "info": 2}


def _numbers(s: str) -> list[str]:
    return sorted(n.replace(",", ".") for n in re.findall(r"\d+(?:[.,]\d+)?", s))


def check_project(p: Project, lang: str | None = None) -> list[Warning]:
    out: list[Warning] = []
    for tgt in [lang] if lang else p.target_langs:

        def warn(idx: int, seg_id: int | None, kind: str, sev: Severity, msg: str, tgt: str = tgt) -> None:
            out.append(Warning(segment_id=seg_id, idx=idx, lang=tgt, type=kind, severity=sev, message=msg))

        variants: dict[str, dict[str, int]] = defaultdict(dict)  # source term -> {translation: first segment idx}
        unlisted: dict[str, int] = defaultdict(int)
        for seg in p.segments:
            tr = seg.translation(tgt)

            def w(kind: str, sev: Severity, msg: str, seg: Segment = seg) -> None:
                warn(seg.idx, seg.id, kind, sev, msg)

            if tr is None or not tr.text.strip():
                w("untranslated", "error", "Keine Übersetzung vorhanden.")
                continue
            terms = [Term.model_validate(t) for t in tr.terms]
            if (
                tr.text.strip().lower() == seg.source_text.strip().lower()
                and len(seg.source_text.split()) > 2
                and not all(t.category == "protected" for t in terms)
            ):
                w("untranslated", "warning", "Text ist identisch mit dem Original (nicht übersetzt?).")
            for t in terms:
                if t.category == "unknown":
                    w("unknown_term", "warning", f"Unbekannter/fehlerhafter Begriff: „{t.source}“.")
                elif t.category == "ambiguous":
                    w("ambiguous_term", "info", f"Mehrdeutiger Begriff „{t.source}“ → „{t.target}“ prüfen.")
                elif t.category in ("glossary", "protected") and not t.ok:
                    w("glossary_violation", "error", f"„{t.target}“ (für „{t.source}“) fehlt in der Übersetzung.")
                elif t.category == "technical":
                    variants[t.source.lower()].setdefault(t.target.lower(), seg.idx)
                    unlisted[t.source.lower()] += 1
            if _numbers(seg.source_text) != _numbers(tr.text):
                w("formatting", "warning", "Zahlen in Original und Übersetzung unterscheiden sich.")
            if seg.source_text.count("\n") != tr.text.count("\n"):
                w("formatting", "info", "Anzahl der Zeilenumbrüche unterscheidet sich.")
            if len(tr.text) > 2.5 * len(seg.source_text) + 20:
                w("formatting", "info", "Übersetzung ist deutlich länger als das Original (Layout prüfen).")
        for term, vs in variants.items():
            if len(vs) > 1:
                warn(
                    min(vs.values()),
                    None,
                    "contradiction",
                    "warning",
                    f"Widersprüchliche Übersetzungen für „{term}“: " + " / ".join(f"„{v}“" for v in vs),
                )
        for term, n in unlisted.items():
            if n >= 2:
                warn(
                    -1, None, "missing_glossary", "info", f"Fachbegriff „{term}“ kommt {n}× vor, fehlt aber im Glossar."
                )
    return sorted(out, key=lambda x: (ORDER[x.severity], x.idx))
