"""a failed translation job keeps the code of its error

The job error was stored as a German sentence, so the English interface showed German. The message is now
English, and the interface writes its own text from the code and its parameters (like every API error).

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-07 21:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("job_error_code", sa.String(), nullable=False, server_default=""))
        batch.add_column(sa.Column("job_error_params", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("job_error_params")
        batch.drop_column("job_error_code")
