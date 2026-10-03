"""Deterministic glossary matching, protected-term detection and compliance checks."""

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..models import GlossaryEntry
from ..schemas import Term

# article numbers / product codes: contain a digit and a capital letter or dash, e.g. "AB-1234"
PROTECTED = re.compile(r"\b(?=[A-Z0-9\-_/.]*\d)(?=[A-Z0-9\-_/.]*[A-Z\-_/])[A-Z0-9][A-Z0-9\-_/.]{3,}\b")


def pattern(term: str) -> re.Pattern[str]:
    """Word boundaries plus tolerance for inflection (Korpus -> Korpusse, drawer -> drawers)."""
    return re.compile(rf"(?<!\w){re.escape(term)}\w{{0,3}}(?!\w)", re.I)


@dataclass
class Hit:
    entry_id: int
    matched: str  # text as it appears in the segment
    target: str
    target_forms: list[str]
    dnt: bool
    description: str
    category: str

    def ok_in(self, translation: str) -> bool:
        return any(pattern(t).search(translation) for t in self.target_forms)

    def term(self) -> Term:
        return Term(
            source=self.matched,
            target=self.matched if self.dnt else self.target,
            category="protected" if self.category == "product" else "glossary",
            alternatives=[t for t in self.target_forms if t != self.target],
            description=self.description,
            glossary_id=self.entry_id,
            dnt=self.dnt,
        )


@dataclass
class Form:
    """One searchable surface form (term or synonym) of a glossary entry."""

    entry: GlossaryEntry
    pat: re.Pattern[str]
    target: str
    target_forms: list[str]


def build_index(db: Session, src: str, tgt: str) -> list[Form]:
    """All usable surface forms for src->tgt, longest first so compounds win over parts."""
    forms: list[Form] = []
    for e in db.query(GlossaryEntry).filter(GlossaryEntry.status != "rejected"):
        s, t = e.terms.get(src), e.terms.get(tgt)
        if not s or not (t or e.do_not_translate):
            continue
        targets = ([t] if t else []) + e.synonyms.get(tgt, [])
        forms += [Form(e, pattern(f), t or s, targets or [s]) for f in [s, *e.synonyms.get(src, [])] if f.strip()]
    return sorted(forms, key=lambda f: -len(f.pat.pattern))


def match_segment(text: str, index: list[Form]) -> list[Hit]:
    """Non-overlapping glossary hits, one per entry."""
    taken: list[tuple[int, int]] = []
    hits: dict[int, Hit] = {}
    for f in index:
        for m in f.pat.finditer(text):
            if any(m.start() < b and m.end() > a for a, b in taken) or f.entry.id in hits:
                continue
            taken.append((m.start(), m.end()))
            e = f.entry
            hits[e.id] = Hit(e.id, m.group(0), f.target, f.target_forms, e.do_not_translate, e.description, e.category)
    return list(hits.values())


def find_protected(text: str) -> list[str]:
    return list(dict.fromkeys(PROTECTED.findall(text)))
