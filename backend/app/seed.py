"""Demo users and a small kitchen glossary (fictional demo data)."""

from sqlalchemy.orm import Session

from .auth import hash_password
from .models import GlossaryEntry, GlossaryVersion, User

USERS = [
    ("admin", "Admin", "admin", "admin123"),
    ("reviewer", "Petra Prüfer", "reviewer", "reviewer123"),
    ("translator", "Tom Translator", "translator", "translator123"),
]

# de, en, de synonyms, en synonyms, description, do_not_translate, category
GLOSSARY: list[tuple[str, str, list[str], list[str], str, bool, str]] = [
    ("Korpus", "carcass", ["Schrankkorpus"], ["cabinet body"], "Tragender Kasten eines Schranks", False, "technical"),
    (
        "Frontblende",
        "front panel",
        ["Front"],
        ["door front"],
        "Sichtbare Vorderseite von Türen und Schubladen",
        False,
        "technical",
    ),
    (
        "Arbeitsplatte",
        "worktop",
        ["Küchenarbeitsplatte"],
        ["countertop"],
        "Waagerechte Arbeitsfläche",
        False,
        "technical",
    ),
    (
        "Sockelblende",
        "plinth",
        ["Sockelleiste"],
        ["kickboard", "toe kick"],
        "Abdeckung unter den Unterschränken",
        False,
        "technical",
    ),
    ("Unterschrank", "base unit", [], ["base cabinet"], "Schrank unterhalb der Arbeitsplatte", False, "technical"),
    (
        "Hängeschrank",
        "wall unit",
        ["Oberschrank"],
        ["wall cabinet"],
        "An der Wand montierter Schrank",
        False,
        "technical",
    ),
    ("Auszug", "pull-out", ["Vollauszug"], ["drawer runner"], "Ausziehbare Schublade oder Einlage", False, "technical"),
    (
        "Dunstabzugshaube",
        "extractor hood",
        ["Dunstabzug"],
        ["cooker hood"],
        "Lüftungsgerät über dem Kochfeld",
        False,
        "technical",
    ),
    (
        "Einlegeboden",
        "shelf",
        ["Fachboden"],
        ["adjustable shelf"],
        "Verstellbarer Boden im Schrank",
        False,
        "technical",
    ),
    ("Scharnier", "hinge", ["Topfband"], ["cup hinge"], "Beschlag zur Türbefestigung", False, "technical"),
    (
        "Nischenrückwand",
        "splashback",
        [],
        ["back panel"],
        "Verkleidung zwischen Arbeitsplatte und Hängeschrank",
        False,
        "technical",
    ),
    ("Eckschrank", "corner unit", [], ["corner cabinet"], "Schrank für die Küchenecke", False, "technical"),
    ("Rotpunkt", "Rotpunkt", [], [], "Firmenname – nicht übersetzen", True, "product"),
    ("Rotpunkt Kitchen Line", "Rotpunkt Kitchen Line", [], [], "Produktlinie – nicht übersetzen", True, "product"),
]


def seed(db: Session) -> None:
    if not db.query(User).count():
        db.add_all(User(username=n, full_name=f, role=r, password_hash=hash_password(p)) for n, f, r, p in USERS)
    if not db.query(GlossaryEntry).count():
        for de, en, sde, sen, desc, dnt, cat in GLOSSARY:
            e = GlossaryEntry(
                terms={"de": de, "en": en},
                synonyms={"de": sde, "en": sen},
                description=desc,
                do_not_translate=dnt,
                category=cat,
                updated_by="seed",
            )
            db.add(e)
            db.flush()
            db.add(
                GlossaryVersion(
                    entry_id=e.id,
                    entry_version=1,
                    action="create",
                    changed_by="seed",
                    data={
                        "terms": e.terms,
                        "synonyms": e.synonyms,
                        "description": desc,
                        "category": cat,
                        "do_not_translate": dnt,
                        "status": "approved",
                    },
                )
            )
    db.commit()
