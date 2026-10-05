"""database constraints

Enum values, ranges and uniqueness are now enforced by the database itself (CHECK, UNIQUE), foreign keys
cascade on delete, `export_files.release_id` becomes a real optional foreign key, and the project list gets
an index. The values below are frozen on purpose: a migration must not change when the enums change.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-04 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# SQLite reports foreign keys without a name; this convention names them so that batch mode can drop them.
NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}

STATUSES = ("new", "preview_ready", "in_review", "approved", "archived")
JOB_STATES = ("idle", "running", "done", "error")
FORMATS = ("docx", "xlsx", "pdf")
MODES = ("translation", "both")
ROLES = ("translator", "reviewer", "admin")
CATEGORIES = ("technical", "product")
GLOSSARY_STATUSES = ("draft", "approved", "rejected")
ACTIONS = ("create", "update", "delete")

# (table, column, allowed values)
ENUM_CHECKS = [
    ("users", "role", ROLES),
    ("projects", "status", STATUSES),
    ("projects", "job_state", JOB_STATES),
    ("projects", "file_type", FORMATS),
    ("glossary_entries", "category", CATEGORIES),
    ("glossary_entries", "status", GLOSSARY_STATUSES),
    ("glossary_versions", "action", ACTIONS),
    ("export_files", "format", FORMATS),
    ("export_files", "mode", MODES),
    ("export_templates", "format", FORMATS),
]
# (table, constraint name, condition)
RANGE_CHECKS = [
    ("projects", "ck_projects_job_progress", "job_progress BETWEEN 0 AND 100"),
    ("segments", "ck_segments_idx", "idx >= 0"),
    ("glossary_entries", "ck_glossary_entries_version", "version >= 1"),
    ("releases", "ck_releases_change_count", "change_count >= 0"),
]
# (table, column, referenced table, new name, on delete)
FOREIGN_KEYS = [
    ("segments", "project_id", "projects", "fk_segments_project_id", "CASCADE"),
    ("translations", "segment_id", "segments", "fk_translations_segment_id", "CASCADE"),
    ("releases", "project_id", "projects", "fk_releases_project_id", "CASCADE"),
    ("export_files", "project_id", "projects", "fk_export_files_project_id", "CASCADE"),
]


def _enum_condition(column: str, values: Sequence[str]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _foreign_key_name(table: str, column: str, referred: str) -> str:
    """The name the database gave the foreign key (PostgreSQL), or the convention name (SQLite: unnamed)."""
    if context.is_offline_mode():  # no database to ask: PostgreSQL's own naming scheme
        return f"{table}_{column}_fkey"
    for fk in sa.inspect(op.get_bind()).get_foreign_keys(table):
        if fk["constrained_columns"] == [column] and fk["referred_table"] == referred and fk["name"]:
            return str(fk["name"])
    return f"fk_{table}_{column}_{referred}"


def upgrade() -> None:
    # 1. data that the new rules would reject
    with op.batch_alter_table("export_files", naming_convention=NAMING) as batch:
        batch.alter_column("release_id", existing_type=sa.Integer(), nullable=True)
    op.execute("UPDATE export_files SET release_id = NULL WHERE release_id NOT IN (SELECT id FROM releases)")
    op.execute("DELETE FROM translations WHERE id NOT IN (SELECT MAX(id) FROM translations GROUP BY segment_id, lang)")

    # 2. foreign keys: cascade on delete (the old ones are replaced, so the names are known and stable)
    for table, column, referred, name, ondelete in FOREIGN_KEYS:
        old = _foreign_key_name(table, column, referred)
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.drop_constraint(old, type_="foreignkey")
            batch.create_foreign_key(name, referred, [column], ["id"], ondelete=ondelete)
    with op.batch_alter_table("export_files", naming_convention=NAMING) as batch:
        batch.create_foreign_key("fk_export_files_release_id", "releases", ["release_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_export_files_release_id", ["release_id"])

    # 3. uniqueness (the unique indexes make the plain indexes on the same columns redundant)
    with op.batch_alter_table("segments", naming_convention=NAMING) as batch:
        batch.drop_index("ix_segments_project_id")
        batch.create_unique_constraint("uq_segments_project_id_idx", ["project_id", "idx"])
    with op.batch_alter_table("translations", naming_convention=NAMING) as batch:
        batch.drop_index("ix_translations_segment_id")
        batch.create_unique_constraint("uq_translations_segment_id_lang", ["segment_id", "lang"])

    # 4. CHECK constraints
    for table, column, values in ENUM_CHECKS:
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.create_check_constraint(f"ck_{table}_{column}", _enum_condition(column, values))
    for table, name, condition in RANGE_CHECKS:
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.create_check_constraint(name, condition)

    # 5. the project list filters on `archived` and sorts by `updated_at`
    with op.batch_alter_table("projects", naming_convention=NAMING) as batch:
        batch.create_index("ix_projects_archived_updated_at", ["archived", "updated_at"])


def downgrade() -> None:
    with op.batch_alter_table("projects", naming_convention=NAMING) as batch:
        batch.drop_index("ix_projects_archived_updated_at")
    for table, name, _ in RANGE_CHECKS:
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.drop_constraint(name, type_="check")
    for table, column, _ in ENUM_CHECKS:
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.drop_constraint(f"ck_{table}_{column}", type_="check")

    with op.batch_alter_table("translations", naming_convention=NAMING) as batch:
        batch.drop_constraint("uq_translations_segment_id_lang", type_="unique")
        batch.create_index("ix_translations_segment_id", ["segment_id"])
    with op.batch_alter_table("segments", naming_convention=NAMING) as batch:
        batch.drop_constraint("uq_segments_project_id_idx", type_="unique")
        batch.create_index("ix_segments_project_id", ["project_id"])

    with op.batch_alter_table("export_files", naming_convention=NAMING) as batch:
        batch.drop_index("ix_export_files_release_id")
        batch.drop_constraint("fk_export_files_release_id", type_="foreignkey")
    for table, column, referred, name, _ in FOREIGN_KEYS:
        with op.batch_alter_table(table, naming_convention=NAMING) as batch:
            batch.drop_constraint(name, type_="foreignkey")
            batch.create_foreign_key(f"{table}_{column}_fkey", referred, [column], ["id"])
    op.execute("UPDATE export_files SET release_id = 0 WHERE release_id IS NULL")
    with op.batch_alter_table("export_files", naming_convention=NAMING) as batch:
        batch.alter_column("release_id", existing_type=sa.Integer(), nullable=False)
