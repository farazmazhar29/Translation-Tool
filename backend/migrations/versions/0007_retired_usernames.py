"""retired usernames

Users can be deleted. Projects, approvals, exports and glossary changes keep naming them (the names are stored as
text), so a deleted user's name is kept here and can never be registered or given to someone else.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-07 19:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "retired_usernames",
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("retired_by", sa.String(), nullable=False),
        sa.Column("retired_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("username"),
    )


def downgrade() -> None:
    op.drop_table("retired_usernames")
