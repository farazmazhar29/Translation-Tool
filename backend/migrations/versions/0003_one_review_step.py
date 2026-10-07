"""one review step

The project state "in_review" is gone: a finished preview waits for the reviewer's approval directly
(new -> preview_ready -> approved). Projects that were "in_review" are moved to "preview_ready", which is where
they would have been before somebody sent them on.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-06 12:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}
BEFORE = ("new", "preview_ready", "in_review", "approved", "archived")
AFTER = ("new", "preview_ready", "approved", "archived")


def _condition(values: Sequence[str]) -> str:
    return f"status IN ({', '.join(repr(v) for v in values)})"


def _replace_check(values: Sequence[str]) -> None:
    with op.batch_alter_table("projects", naming_convention=NAMING) as batch:
        batch.drop_constraint("ck_projects_status", type_="check")
        batch.create_check_constraint("ck_projects_status", _condition(values))


def upgrade() -> None:
    op.execute("UPDATE projects SET status = 'preview_ready' WHERE status = 'in_review'")
    _replace_check(AFTER)


def downgrade() -> None:
    _replace_check(BEFORE)  # nothing to move back: no project is "in_review" any more
