"""Every fixed set of values of the domain in one place. They are `StrEnum`s: members compare equal to their
string value, serialise as that string in JSON and show up as `enum` in the Swagger schema."""

from enum import StrEnum


class Role(StrEnum):
    """Ordered by privilege: a reviewer can do everything a translator can, an admin everything."""

    TRANSLATOR = "translator"
    REVIEWER = "reviewer"
    ADMIN = "admin"

    @property
    def rank(self) -> int:
        return list(Role).index(self)


class ProjectStatus(StrEnum):
    NEW = "new"
    PREVIEW_READY = "preview_ready"
    APPROVED = "approved"
    ARCHIVED = "archived"


EDITABLE_STATUSES = (ProjectStatus.NEW, ProjectStatus.PREVIEW_READY)
FINISHED_STATUSES = (ProjectStatus.APPROVED, ProjectStatus.ARCHIVED)  # export is possible, edits are not


class ArchiveFilter(StrEnum):
    """Which projects the project list shows."""

    NO = "no"  # active ones (default)
    ONLY = "only"
    ALL = "all"


class JobState(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


class Lang(StrEnum):
    """Supported translation languages (German <-> English)."""

    DE = "de"
    EN = "en"


AUTO = "auto"  # `Project.source_lang` before the language has been chosen: detect it from the text


class GlossaryStatus(StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class EntryCategory(StrEnum):
    """Category of a glossary entry."""

    TECHNICAL = "technical"
    PRODUCT = "product"


class GlossaryAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class TermCategory(StrEnum):
    """How a highlighted term in a translation came about (also its colour in the UI)."""

    TECHNICAL = "technical"
    GLOSSARY = "glossary"
    AMBIGUOUS = "ambiguous"
    UNKNOWN = "unknown"
    PROTECTED = "protected"


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class QualityCode(StrEnum):
    """What the quality check found. The interface writes the sentence for each code in its own language."""

    NO_TRANSLATION = "no_translation"
    IDENTICAL_TEXT = "identical_text"
    UNKNOWN_TERM = "unknown_term"
    AMBIGUOUS_TERM = "ambiguous_term"
    GLOSSARY_VIOLATION = "glossary_violation"
    NUMBERS_DIFFER = "numbers_differ"
    LINE_BREAKS_DIFFER = "line_breaks_differ"
    TOO_LONG = "too_long"
    CONTRADICTION = "contradiction"
    MISSING_GLOSSARY = "missing_glossary"


class FileFormat(StrEnum):
    """File types the app reads (uploads) and writes (exports)."""

    DOCX = "docx"
    XLSX = "xlsx"
    PDF = "pdf"


class Provider(StrEnum):
    """Translation back ends: the Gemini API, or an offline dictionary for tests and demos without a key."""

    GEMINI = "gemini"
    MOCK = "mock"


class ExportMode(StrEnum):
    TRANSLATION = "translation"  # translation only
    BOTH = "both"  # original + translation
