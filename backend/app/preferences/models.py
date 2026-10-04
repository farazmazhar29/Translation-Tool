"""Application settings (one JSON row)."""

from typing import Any

from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AppSetting(Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(default=dict)
