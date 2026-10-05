"""Run database migrations (`python -m app.migrate`, or automatically at startup when AUTO_MIGRATE is on)."""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from .db import engine

log = logging.getLogger(__name__)
BACKEND = Path(__file__).resolve().parents[2]
BASELINE = "0001"  # the schema `create_all` produced in the first version


def alembic_config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    return cfg


def upgrade_to_head() -> None:
    cfg = alembic_config()
    tables = set(inspect(engine).get_table_names())
    if "users" in tables and "alembic_version" not in tables:
        # Database created by the first version (`create_all`): adopt it instead of failing with "table exists".
        log.warning("Existing unversioned database found - stamping it as the baseline revision")
        command.stamp(cfg, BASELINE)
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    upgrade_to_head()
