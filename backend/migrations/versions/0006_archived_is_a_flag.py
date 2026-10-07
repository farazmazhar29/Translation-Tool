"""archived is a flag, not a status

Archiving had two meanings: the archive button set the flag `archived`, an export with "archive afterwards" also
replaced the status with "archived". The list then showed "Approved" for one archived project and "Archived" for
another. Archiving is now only the flag; the status stays where the workflow is. Projects with the status
"archived" were approved before, so they become approved (and archived).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-07 17:00:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}
BEFORE = ("new", "preview_ready", "approved", "archived")
AFTER = ("new", "preview_ready", "approved")


def _replace_check(values: Sequence[str]) -> None:
    with op.batch_alter_table("projects", naming_convention=NAMING) as batch:
        batch.drop_constraint("ck_projects_status", type_="check")
        batch.create_check_constraint("ck_projects_status", f"status IN ({', '.join(repr(v) for v in values)})")


def upgrade() -> None:
    op.execute("UPDATE projects SET status = 'approved', archived = true WHERE status = 'archived'")
    _replace_check(AFTER)


def downgrade() -> None:
    _replace_check(BEFORE)  # nothing to move back: the flag already says which projects are archived
