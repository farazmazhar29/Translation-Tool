"""Dashboard API contract."""

from app.core.schemas import Schema
from app.projects.schemas import ProjectOut


class TopTerm(Schema):
    id: int
    term: str
    count: int


class Stats(Schema):
    projects_total: int
    segments: int
    translations: int
    manual_edits: int
    glossary_entries: int
    by_language: dict[str, int]
    releases_per_day: dict[str, int]


class DashboardOut(Schema):
    open: int
    in_review: int
    approved: int
    edited_today: int
    recent: list[ProjectOut]
    top_terms: list[TopTerm]
    stats: Stats
