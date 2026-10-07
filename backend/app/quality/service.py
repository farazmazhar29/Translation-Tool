"""Quality check before approval. It only warns; the reviewer decides."""

import re
from collections import defaultdict
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.core.enums import QualityCode, Severity, TermCategory
from app.glossary.schemas import Term
from app.glossary.service import build_index, pattern
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


# Endings that only make a plural or a case, per target language: "cabinet hanger" and "cabinet hangers" are the
# same translation (German "Schrankaufhänger" is both), not a contradiction.
ENDINGS = {"en": re.compile(r"(?<=\w{3})(?:es|s)$"), "de": re.compile(r"(?<=\w{3})(?:en|er|es|e|n|s)$")}


def _same_word(text: str, lang: str) -> str:
    """A translation reduced to what tells two translations apart."""
    text = text.strip().lower()
    ending = ENDINGS.get(lang)
    return ending.sub("", text) if ending else text


OPTION_SEP = "|"  # joins the variants of a contradiction in `params["options"]`; never part of a term


def _as_entry(text: str, lang: str) -> str:
    """A translation as a glossary entry: without the capital of a sentence start ("Nickel-plated" -> "nickel-plated"),
    but abbreviations ("LED lighting") and German nouns keep theirs."""
    if lang == "de" or len(text) < 2 or not text[0].isupper() or text[1].isupper():
        return text
    return text[0].lower() + text[1:]


class Glossary(NamedTuple):
    """The current glossary of one language pair: what a term may look like, and its accepted translations."""

    forms: list[tuple[re.Pattern[str], list[str]]]

    def translations(self, source: str) -> list[str] | None:
        """The accepted translations of a term, or None when it is not in the glossary."""
        return next((targets for pat, targets in self.forms if pat.fullmatch(source)), None)


def finding_key(lang: str, code: QualityCode, idx: int, params: dict[str, str]) -> str:
    """The same finding gets the same key on every check (while the text stays), so that it can be accepted."""
    return f"{lang}|{code}|{idx}|{params.get('term') or params.get('source') or ''}"


def check_project(p: Project, lang: str | None = None, db: Session | None = None) -> list[QualityWarning]:
    """Findings with a German `message` (for reports and exports) plus a `code` and `params`, so that the
    interface can write the same sentence in the language of the user.

    With `db`, the current glossary counts: a term added since the translation is no longer "missing from the
    glossary", and an ambiguous term whose translation the glossary confirms is no longer ambiguous. Findings the
    reviewer accepted are marked `accepted` (errors cannot be accepted)."""
    out: list[QualityWarning] = []
    for tgt in [lang] if lang else p.targets:
        glossary = Glossary([(f.pat, f.target_forms) for f in build_index(db, p.source, tgt)] if db else [])

        def warn(
            idx: int,
            seg_id: int | None,
            code: QualityCode,
            sev: Severity,
            msg: str,
            params: dict[str, str] | None = None,
            tgt: str = tgt,
        ) -> None:
            values = params or {}
            out.append(
                QualityWarning(
                    segment_id=seg_id,
                    idx=idx,
                    lang=tgt,
                    type=TYPE_OF.get(code, code.value),
                    code=code,
                    params=values,
                    severity=sev,
                    message=msg,
                    key=finding_key(tgt, code, idx, values),
                )
            )

        # source term (lower case) -> {translation, reduced by _same_word: (as written, first segment idx)}
        variants: dict[str, dict[str, tuple[str, int]]] = defaultdict(dict)
        spelling: dict[str, str] = {}  # source term (lower case) -> as first written, e.g. "Hängeschränke"
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
                # a term added to the glossary after the translation: the glossary decides now
                listed = glossary.translations(t.source) if t.category != TermCategory.GLOSSARY else None
                follows = listed is not None and any(pattern(x).search(tr.text) for x in listed)
                if t.category == TermCategory.UNKNOWN:
                    msg = f"Unbekannter/fehlerhafter Begriff: „{t.source}“."
                    warn(idx, sid, QualityCode.UNKNOWN_TERM, Severity.WARNING, msg, names)
                elif listed is not None and t.category in (TermCategory.TECHNICAL, TermCategory.AMBIGUOUS):
                    if not follows:
                        glossary_target = {"source": t.source, "target": listed[0] if listed else t.source}
                        msg = f"„{glossary_target['target']}“ (für „{t.source}“) fehlt in der Übersetzung."
                        warn(idx, sid, QualityCode.GLOSSARY_VIOLATION, Severity.ERROR, msg, glossary_target)
                elif t.category == TermCategory.AMBIGUOUS:
                    msg = f"Mehrdeutiger Begriff „{t.source}“ → „{t.target}“ prüfen."
                    warn(idx, sid, QualityCode.AMBIGUOUS_TERM, Severity.INFO, msg, names)
                elif t.category in (TermCategory.GLOSSARY, TermCategory.PROTECTED) and not t.ok:
                    msg = f"„{t.target}“ (für „{t.source}“) fehlt in der Übersetzung."
                    warn(idx, sid, QualityCode.GLOSSARY_VIOLATION, Severity.ERROR, msg, names)
                elif t.category == TermCategory.TECHNICAL:
                    key = t.source.lower()
                    spelling.setdefault(key, t.source)
                    variants[key].setdefault(_same_word(t.target, tgt), (t.target, seg.idx))
                    unlisted[key] += 1
            if _numbers(seg.source_text) != _numbers(tr.text):
                msg = "Zahlen in Original und Übersetzung unterscheiden sich."
                warn(idx, sid, QualityCode.NUMBERS_DIFFER, Severity.WARNING, msg)
            if seg.source_text.count("\n") != tr.text.count("\n"):
                msg = "Anzahl der Zeilenumbrüche unterscheidet sich."
                warn(idx, sid, QualityCode.LINE_BREAKS_DIFFER, Severity.INFO, msg)
            if len(tr.text) > 2.5 * len(seg.source_text) + 20:
                msg = "Übersetzung ist deutlich länger als das Original (Layout prüfen)."
                warn(idx, sid, QualityCode.TOO_LONG, Severity.INFO, msg)
        for key, vs in variants.items():
            term, written = spelling[key], [v for v, _ in vs.values()]
            if len(vs) > 1:
                joined = " / ".join(f"„{v}“" for v in written)
                warn(
                    min(i for _, i in vs.values()),
                    None,
                    QualityCode.CONTRADICTION,
                    Severity.WARNING,
                    f"Widersprüchliche Übersetzungen für „{term}“: {joined}",
                    # `options`: the translations to choose from when the interface unifies them
                    {"term": term, "variants": joined, "options": OPTION_SEP.join(written)},
                )
        for key, n in unlisted.items():
            if n >= 2:
                term = spelling[key]
                msg = f"Fachbegriff „{term}“ kommt {n}× vor, fehlt aber im Glossar."
                # `target`: the translation used first, offered when the interface adds the term to the glossary
                target = _as_entry(next(iter(variants[key].values()))[0], tgt)
                params = {"term": term, "count": str(n), "target": target}
                warn(-1, None, QualityCode.MISSING_GLOSSARY, Severity.INFO, msg, params)
    accepted = set(p.accepted_findings or [])  # an unsaved project has no list yet
    for w in out:
        w.accepted = w.key in accepted and w.severity != Severity.ERROR
    return sorted(out, key=lambda x: (x.accepted, ORDER[x.severity], x.idx))
