"""Demo data (fictional) for development, and an optional first admin for production."""

from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.security import hash_password
from app.core.config import settings
from app.core.enums import EntryCategory, GlossaryAction, GlossaryStatus, Role
from app.glossary.models import GlossaryEntry, GlossaryVersion

USERS = [
    ("admin", "Admin", Role.ADMIN, "admin123"),
    ("reviewer", "Petra Prüfer", Role.REVIEWER, "reviewer123"),
    ("translator", "Tom Translator", Role.TRANSLATOR, "translator123"),
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


def seed_users(db: Session) -> None:
    """Only when the database has no users yet."""
    if db.query(User).count():
        return
    if settings.seed_demo_data:
        db.add_all(User(username=n, full_name=f, role=r, password_hash=hash_password(p)) for n, f, r, p in USERS)
    elif settings.bootstrap_admin_username and settings.bootstrap_admin_password:
        db.add(
            User(
                username=settings.bootstrap_admin_username,
                full_name="Administrator",
                role=Role.ADMIN,
                password_hash=hash_password(settings.bootstrap_admin_password),
            )
        )


def seed_glossary(db: Session) -> None:
    if db.query(GlossaryEntry).count():
        return
    for de, en, sde, sen, desc, dnt, cat in GLOSSARY:
        e = GlossaryEntry(
            terms={"de": de, "en": en},
            synonyms={"de": sde, "en": sen},
            description=desc,
            do_not_translate=dnt,
            category=EntryCategory(cat),
            updated_by="seed",
        )
        db.add(e)
        db.flush()
        db.add(
            GlossaryVersion(
                entry_id=e.id,
                entry_version=1,
                action=GlossaryAction.CREATE,
                changed_by="seed",
                data={
                    "terms": e.terms,
                    "synonyms": e.synonyms,
                    "description": desc,
                    "category": EntryCategory(cat),
                    "do_not_translate": dnt,
                    "status": GlossaryStatus.APPROVED,
                },
            )
        )


def seed(db: Session) -> None:
    """Demo content is created once, with the very first start. A glossary that someone emptied stays empty."""
    first_run = db.query(User).count() == 0
    seed_users(db)
    if settings.seed_demo_data and first_run:  # the sample glossary is demo content, not for production
        seed_glossary(db)
    db.commit()
