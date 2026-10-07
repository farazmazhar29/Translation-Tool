"""Export API contract."""

from datetime import datetime
from typing import Literal, Self

from openpyxl.utils import column_index_from_string
from pydantic import Field, field_validator, model_validator

from app.core.enums import ExportMode, FileFormat
from app.core.schemas import ORM, Schema

MAX_EXCEL_COLUMN = 16384  # XFD


class ExcelLayout(Schema):
    """Free choice of columns for Excel exports ("Erweiterte Einstellungen"). An empty column letter omits it."""

    sheet_name: str = Field("Übersetzung", min_length=1, max_length=31)  # Excel's own limit
    source_col: str = Field("A", pattern=r"^[A-Za-z]{1,3}$")
    target_col: str = Field("B", pattern=r"^[A-Za-z]{1,3}$")
    comment_col: str = Field("C", pattern=r"^[A-Za-z]{0,3}$")
    location_col: str = Field("", pattern=r"^[A-Za-z]{0,3}$")
    start_row: int = Field(2, ge=1, le=100_000)
    header: bool = True

    @field_validator("sheet_name")
    @classmethod
    def valid_sheet_name(cls, v: str) -> str:
        if any(c in v for c in "[]:*?/\\"):
            raise ValueError("Blattname darf keines der Zeichen [ ] : * ? / \\ enthalten")
        return v

    @model_validator(mode="after")
    def valid_columns(self) -> Self:
        used = [c.upper() for c in (self.source_col, self.target_col, self.comment_col, self.location_col) if c]
        if any(column_index_from_string(c) > MAX_EXCEL_COLUMN for c in used):
            raise ValueError("Spalte liegt außerhalb des Excel-Bereichs (A–XFD)")
        if len(set(used)) != len(used):
            raise ValueError("Jede Spalte darf nur einmal verwendet werden")
        return self


class ExportIn(Schema):
    lang: str
    format: FileFormat = FileFormat.DOCX
    mode: ExportMode = ExportMode.TRANSLATION
    include_report: bool = False
    include_comments: bool = False
    config: ExcelLayout | None = Field(None, description="Excel column layout (only used for .xlsx)")
    template_id: int | None = None
    archive_after: bool = True


class ExportFileOut(ORM):
    id: int
    filename: str
    format: FileFormat
    lang: str
    mode: ExportMode
    created_by: str
    created_at: datetime
    release_id: int | None


class TemplateIn(Schema):
    name: str
    format: Literal[FileFormat.XLSX] = FileFormat.XLSX  # only Excel exports have a configurable layout
    config: ExcelLayout


class TemplateOut(TemplateIn, ORM):
    id: int
