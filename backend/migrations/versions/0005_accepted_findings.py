"""accepted findings

A quality finding that is a judgment call (a long translation, a different number of line breaks, an ambiguous
term) can be accepted by the reviewer; the project remembers which ones, so they stay accepted on the next check.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-07 16:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("accepted_findings", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("accepted_findings")
