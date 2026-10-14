"""uploaded and exported files are kept in the database

A host with an ephemeral disk (Render's free tier) wipes the uploads and exports on every restart, while the
database survives. The files are now stored in the database too; the disk only holds a working copy that the app
writes back when it is missing. Existing files are copied in where the disk still has them.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-14 10:00:00

"""

from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import context, op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = {"projects": ("file_path", "file_data"), "export_files": ("path", "data")}


def upgrade() -> None:
    for table, (_, data_column) in COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column(data_column, sa.LargeBinary(), nullable=True))
    if context.is_offline_mode():  # rendering SQL only: there are no rows to copy
        return
    conn = op.get_bind()
    for table, (path_column, data_column) in COLUMNS.items():
        rows = conn.execute(sa.text(f"SELECT id, {path_column} FROM {table}")).all()  # noqa: S608 - fixed names
        for row_id, path in rows:
            file = Path(path)
            if path and file.is_file():
                conn.execute(
                    sa.text(f"UPDATE {table} SET {data_column} = :data WHERE id = :id"),  # noqa: S608 - fixed names
                    {"data": file.read_bytes(), "id": row_id},
                )


def downgrade() -> None:
    for table, (_, data_column) in COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            batch.drop_column(data_column)
