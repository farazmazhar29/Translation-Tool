"""Export approved translations as Word, Excel or PDF.

mode   "translation" = translation only | "both" = original + translation
opts   include_report (quality report), include_comments
config Excel layout ("Erweiterte Einstellungen"): free choice of source/target/comment/position columns
"""

import re
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from docx import Document
from docx.shared import Pt
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import column_index_from_string
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import PropertySet, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.core.enums import ExportMode, FileFormat
from app.projects import parsing
from app.projects.models import Project
from app.quality.schemas import QualityWarning

XLSX_DEFAULTS: dict[str, Any] = {
    "sheet_name": "Übersetzung",
    "source_col": "A",
    "target_col": "B",
    "comment_col": "C",
    "location_col": "",
    "start_row": 2,
    "header": True,
}
Exporter = Callable[[Project, str, ExportMode, dict[str, bool], list[QualityWarning], dict[str, Any] | None], Path]


def rows(p: Project, lang: str) -> list[dict[str, Any]]:
    def row(seg_no: int, loc: dict[str, Any], src: str, text: str, comment: str) -> dict[str, Any]:
        place = {
            FileFormat.XLSX: f"{loc.get('sheet')}!{loc.get('cell')}",
            FileFormat.PDF: f"Seite {loc.get('page')}",
        }.get(loc["type"], f"Absatz {loc.get('p', 0) + 1}")
        return {"no": seg_no, "locator": loc, "source": src, "target": text, "comment": comment, "location": place}

    return [
        row(s.idx + 1, s.locator, s.source_text, t.text if t else "", t.comment if t else "")
        for s in p.segments
        for t in [s.translation(lang)]
    ]


def out_path(ext: FileFormat) -> Path:
    """Stored exports get a unique name: two projects with the same filename must never overwrite each other."""
    return settings.data_dir / "exports" / f"{uuid.uuid4().hex}.{ext}"


def download_name(p: Project, lang: str, mode: ExportMode, ext: FileFormat) -> str:
    """What the user sees when downloading (sanitised, since the original filename is user input)."""
    stem = re.sub(r"[^\w.-]+", "_", Path(p.filename).stem).strip("._") or f"projekt-{p.id}"
    return f"{stem[:80]}_{lang}_{mode}.{ext}"


def report_lines(warnings: list[QualityWarning]) -> list[str]:
    return [f"[{w.severity.upper()}] Segment {w.idx + 1 if w.idx >= 0 else '-'}: {w.message}" for w in warnings]


# Word
def to_docx(
    p: Project,
    lang: str,
    mode: ExportMode,
    opts: dict[str, bool],
    warnings: list[QualityWarning],
    _config: dict[str, Any] | None = None,
) -> Path:
    data, path = rows(p, lang), out_path(FileFormat.DOCX)
    if mode == ExportMode.TRANSLATION and p.file_type == FileFormat.DOCX and not any(opts.values()):
        parsing.write_docx(Path(p.file_path), path, {r["locator"]["p"]: r["target"] for r in data if r["target"]})
        return path  # original layout and formatting stay intact
    doc = Document()
    doc.add_heading(f"{p.name} ({lang.upper()})", level=1)
    if mode == ExportMode.BOTH:
        head = ["#", "Original", "Übersetzung"] + (["Kommentar"] if opts["include_comments"] else [])
        table = doc.add_table(rows=1, cols=len(head), style="Light Grid Accent 1")
        for cell, h in zip(table.rows[0].cells, head, strict=False):
            cell.text = h
        for r in data:
            values = [str(r["no"]), r["source"], r["target"], r["comment"]]
            for cell, v in zip(table.add_row().cells, values, strict=False):
                cell.text = v
    else:
        for r in data:
            doc.add_paragraph(r["target"])
            if opts["include_comments"] and r["comment"]:
                run = doc.add_paragraph().add_run(f"Kommentar: {r['comment']}")
                run.italic, run.font.size = True, Pt(9)
    if opts["include_report"]:
        doc.add_page_break()
        doc.add_heading("Prüfbericht", level=1)
        for line in report_lines(warnings) or ["Keine Warnungen."]:
            doc.add_paragraph(line, style="List Bullet")
    doc.save(str(path))
    return path


# Excel
def to_xlsx(
    p: Project,
    lang: str,
    mode: ExportMode,
    opts: dict[str, bool],
    warnings: list[QualityWarning],
    config: dict[str, Any] | None = None,
) -> Path:
    data, path = rows(p, lang), out_path(FileFormat.XLSX)
    if mode == ExportMode.TRANSLATION and p.file_type == FileFormat.XLSX and not config and not opts["include_report"]:
        parsing.write_xlsx(
            Path(p.file_path),
            path,
            {(r["locator"]["sheet"], r["locator"]["cell"]): r["target"] for r in data if r["target"]},
        )
        return path
    cfg = {**XLSX_DEFAULTS, **(config or {})}
    wb = Workbook()
    ws = wb.active or wb.create_sheet()
    ws.title = str(cfg["sheet_name"])[:31] or "Übersetzung"
    layout = [(str(cfg["source_col"]), "Original", "source")] if mode == ExportMode.BOTH else []
    layout.append((str(cfg["target_col"]), f"Übersetzung ({lang.upper()})", "target"))
    if opts["include_comments"] and cfg["comment_col"]:
        layout.append((str(cfg["comment_col"]), "Kommentar", "comment"))
    if cfg["location_col"]:
        layout.append((str(cfg["location_col"]), "Position", "location"))
    start = int(cfg["start_row"])
    for col, head, field in layout:
        ws.column_dimensions[col.upper()].width = 60
        if cfg["header"] and start > 1:
            ws.cell(row=start - 1, column=column_index_from_string(col.upper()), value=head).font = Font(bold=True)
        for i, r in enumerate(data):
            ws.cell(row=start + i, column=column_index_from_string(col.upper()), value=r[field])
    if opts["include_report"]:
        rs = wb.create_sheet("Prüfbericht")
        rs.append(["Schweregrad", "Segment", "Typ", "Meldung"])
        rs.column_dimensions["D"].width = 90
        for w in warnings:
            rs.append([w.severity, w.idx + 1 if w.idx >= 0 else "", w.type, w.message])
    wb.save(path)
    return path


# PDF
def to_pdf(
    p: Project,
    lang: str,
    mode: ExportMode,
    opts: dict[str, bool],
    warnings: list[QualityWarning],
    _config: dict[str, Any] | None = None,
) -> Path:
    data, path = rows(p, lang), out_path(FileFormat.PDF)
    styles = getSampleStyleSheet()
    small = styles["BodyText"].clone("small", fontSize=9, leading=11)

    def para(text: str, style: PropertySet = small) -> Paragraph:
        return Paragraph(escape(text), style)

    story: list[Any] = [para(f"{p.name} ({lang.upper()})", styles["Title"])]
    if mode == ExportMode.BOTH:
        comments = opts["include_comments"]
        table: list[list[Any]] = [["#", "Original", "Übersetzung"] + (["Kommentar"] if comments else [])]
        table += [
            [str(r["no"]), para(r["source"]), para(r["target"])] + ([para(r["comment"])] if comments else [])
            for r in data
        ]
        t = Table(table, colWidths=[25, 210, 210] + ([80] if comments else []), repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ]
            )
        )
        story.append(t)
    else:
        for r in data:
            story.append(para(r["target"], styles["BodyText"]))
            if opts["include_comments"] and r["comment"]:
                story.append(para("Kommentar: " + r["comment"]))
    if opts["include_report"]:
        story += [Spacer(1, 20), para("Prüfbericht", styles["Heading1"])]
        story += [para(line) for line in report_lines(warnings) or ["Keine Warnungen."]]
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30).build(story)
    return path


EXPORTERS: dict[FileFormat, Exporter] = {
    FileFormat.DOCX: to_docx,
    FileFormat.XLSX: to_xlsx,
    FileFormat.PDF: to_pdf,
}
