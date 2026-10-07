"""Quality check before approval. It only warns; the reviewer decides."""

import re
from collections import defaultdict

from app.core.enums import QualityCode, Severity, TermCategory
from app.glossary.schemas import Term
from app.projects.models import Project
from app.quality.schemas import QualityWarning

ORDER = {Severity.ERROR: 0, Severity.WARNING: 1, Severity.INFO: 2}
# Findings of the same kind of problem share a `type` (used for filtering and the export report).
TYPE_OF = {
    QualityCode.NO_TRANSLATION: "untranslated",
    QualityCode.IDENTICAL_TEXT: "untranslated",
    QualityCode.NUMBERS_DIFFER: "formatting",
    QualityCode.LINE_BREAKS_DIFFER: "formatting",
    QualityCode.TOO_LONG: "formatting",
}


def _numbers(s: str) -> list[str]:
    return sorted(n.replace(",", ".") for n in re.findall(r"\d+(?:[.,]\d+)?", s))


def check_project(p: Project, lang: str | None = None) -> list[QualityWarning]:
    """Findings with a German `message` (for reports and exports) plus a `code` and `params`, so that the
    interface can write the same sentence in the language of the user."""
    out: list[QualityWarning] = []
    for tgt in [lang] if lang else p.targets:

        def warn(
            idx: int,
            seg_id: int | None,
            code: QualityCode,
            sev: Severity,
            msg: str,
            params: dict[str, str] | None = None,
            tgt: str = tgt,
        ) -> None:
            out.append(
                QualityWarning(
                    segment_id=seg_id,
                    idx=idx,
                    lang=tgt,
                    type=TYPE_OF.get(code, code.value),
                    code=code,
                    params=params or {},
                    severity=sev,
                    message=msg,
                )
            )

        variants: dict[str, dict[str, int]] = defaultdict(dict)  # source term -> {translation: first segment idx}
        unlisted: dict[str, int] = defaultdict(int)
        for seg in p.segments:
            tr = seg.translation(tgt)
            idx, sid = seg.idx, seg.id
            if tr is None or not tr.text.strip():
                warn(idx, sid, QualityCode.NO_TRANSLATION, Severity.ERROR, "Keine Übersetzung vorhanden.")
                continue
            terms = [Term.model_validate(t) for t in tr.terms]
            if (
                tr.text.strip().lower() == seg.source_text.strip().lower()
                and len(seg.source_text.split()) > 2
                and not (
                    terms and all(t.category == TermCategory.PROTECTED for t in terms)
                )  # only codes: may stay as is
            ):
                msg = "Text ist identisch mit dem Original (nicht übersetzt?)."
                warn(idx, sid, QualityCode.IDENTICAL_TEXT, Severity.WARNING, msg)
            for t in terms:
                names = {"source": t.source, "target": t.target}
                if t.category == TermCategory.UNKNOWN:
                    msg = f"Unbekannter/fehlerhafter Begriff: „{t.source}“."
                    warn(idx, sid, QualityCode.UNKNOWN_TERM, Severity.WARNING, msg, names)
                elif t.category == TermCategory.AMBIGUOUS:
                    msg = f"Mehrdeutiger Begriff „{t.source}“ → „{t.target}“ prüfen."
                    warn(idx, sid, QualityCode.AMBIGUOUS_TERM, Severity.INFO, msg, names)
                elif t.category in (TermCategory.GLOSSARY, TermCategory.PROTECTED) and not t.ok:
                    msg = f"„{t.target}“ (für „{t.source}“) fehlt in der Übersetzung."
                    warn(idx, sid, QualityCode.GLOSSARY_VIOLATION, Severity.ERROR, msg, names)
                elif t.category == TermCategory.TECHNICAL:
                    variants[t.source.lower()].setdefault(t.target.lower(), seg.idx)
                    unlisted[t.source.lower()] += 1
            if _numbers(seg.source_text) != _numbers(tr.text):
                msg = "Zahlen in Original und Übersetzung unterscheiden sich."
                warn(idx, sid, QualityCode.NUMBERS_DIFFER, Severity.WARNING, msg)
            if seg.source_text.count("\n") != tr.text.count("\n"):
                msg = "Anzahl der Zeilenumbrüche unterscheidet sich."
                warn(idx, sid, QualityCode.LINE_BREAKS_DIFFER, Severity.INFO, msg)
            if len(tr.text) > 2.5 * len(seg.source_text) + 20:
                msg = "Übersetzung ist deutlich länger als das Original (Layout prüfen)."
                warn(idx, sid, QualityCode.TOO_LONG, Severity.INFO, msg)
        for term, vs in variants.items():
            if len(vs) > 1:
                joined = " / ".join(f"„{v}“" for v in vs)
                warn(
                    min(vs.values()),
                    None,
                    QualityCode.CONTRADICTION,
                    Severity.WARNING,
                    f"Widersprüchliche Übersetzungen für „{term}“: {joined}",
                    {"term": term, "variants": joined},
                )
        for term, n in unlisted.items():
            if n >= 2:
                msg = f"Fachbegriff „{term}“ kommt {n}× vor, fehlt aber im Glossar."
                warn(-1, None, QualityCode.MISSING_GLOSSARY, Severity.INFO, msg, {"term": term, "count": str(n)})
    return sorted(out, key=lambda x: (ORDER[x.severity], x.idx))
