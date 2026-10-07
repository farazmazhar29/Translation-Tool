"""target is the other language

With German and English only, the target language is always the one the text is not written in, so it is no
longer chosen. Projects that listed both languages, or a target equal to their source, get the other language
as their only target; projects whose source is still unknown get none until the user picks it.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-07 10:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCE = "CASE WHEN source_lang = 'auto' THEN detected_lang ELSE source_lang END"


def upgrade() -> None:
    # plain SQL, so that `alembic upgrade --sql` can print it as well
    value = f"""CASE {SOURCE} WHEN 'de' THEN '["en"]' WHEN 'en' THEN '["de"]' ELSE '[]' END"""
    if op.get_context().dialect.name == "postgresql":
        value = f"CAST({value} AS json)"  # PostgreSQL does not turn text into json by itself; SQLite stores the text
    op.execute(f"UPDATE projects SET target_langs = {value}")  # noqa: S608 - fixed text, no user input


def downgrade() -> None:
    pass  # the single target is valid in the previous version too
