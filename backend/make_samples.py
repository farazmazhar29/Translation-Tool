"""Generate fictional demo files in ../samples: `python make_samples.py`."""

from pathlib import Path

from docx import Document
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parents[1] / "samples"
OUT.mkdir(exist_ok=True)


def manual() -> None:
    doc = Document()
    doc.add_heading("Montageanleitung Unterschrank", level=1)
    doc.add_paragraph(
        "Die Rotpunkt Kitchen Line überzeugt durch hochwertige Materialien. "
        "Der Korpus besteht aus beschichteter Spanplatte, die Frontblende aus Eiche furniert."
    )
    doc.add_heading("Lieferumfang", level=2)
    for line in (
        "1 Unterschrank mit Auszug, Artikelnummer UK-4711/60",
        "2 Scharniere (Topfband) für die Tür",
        "1 Sockelblende, weiß, Art.-Nr. SB-2200",
        "Bitte den Einlegeboden vor der Montage prüfen.",
    ):
        doc.add_paragraph(line, style="List Bullet")
    doc.add_heading("Montage", level=2)
    doc.add_paragraph(
        "Den Unterschrank ausrichten und mit der Arbeitsplatte verschrauben. Das Gewicht beträgt 34,5 kg."
    )
    doc.add_paragraph("Die Dunstabzugshaube wird erst nach der Nischenrückwand montiert.")
    table = doc.add_table(rows=3, cols=3, style="Light Grid Accent 1")
    for row, values in zip(
        table.rows,
        [
            ("Artikel", "Bezeichnung", "Preis"),
            ("UK-4711/60", "Unterschrank 60 cm", "249,00 EUR"),
            ("HS-9001", "Hängeschrank mit Glastür", "189,90 EUR"),
        ],
        strict=True,
    ):
        for cell, v in zip(row.cells, values, strict=True):
            cell.text = v
    doc.save(OUT / "Montageanleitung_Unterschrank.docx")


def prices() -> None:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Preisliste"
    ws.append(["Artikel", "Bezeichnung", "Farbe", "Preis"])
    ws.append(["UK-4711/60", "Unterschrank mit Auszug", "Eiche", 249.0])
    ws.append(["HS-9001", "Hängeschrank mit Glastür", "Weiß", 189.9])
    ws.append(["AP-3300", "Arbeitsplatte, 3 m", "Eiche", 420.0])
    ws.append(["Summe", None, None, "=SUM(D2:D4)"])
    wb.save(OUT / "Preisliste.xlsx")


def glossary() -> None:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Glossar"
    ws.append(["de", "en", "de_synonyme", "en_synonyme", "beschreibung", "nicht_uebersetzen", "kategorie", "status"])
    ws.append(
        [
            "Kochinsel",
            "cooking island",
            "Insel",
            "kitchen island",
            "Freistehender Küchenblock",
            "",
            "technical",
            "approved",
        ]
    )
    ws.append(["Zargenprofil", "frame profile", "", "", "Rahmenprofil für Glastüren", "", "technical", "approved"])
    ws.append(["ProLine X", "", "", "", "Produktname", "ja", "product", "approved"])
    wb.save(OUT / "glossar_beispiel.xlsx")


def german_pdf() -> None:
    """One page of German assembly instructions (text, not a scan) to try the PDF translation with."""
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=11, leading=16, spaceAfter=10)
    lines: list[tuple[str, str]] = [
        ("Title", "Montageanleitung Hängeschrank"),
        ("Heading2", "Produktbeschreibung"),
        (
            "body",
            "Der Hängeschrank Modell HS-9001 aus der Rotpunkt Kitchen Line überzeugt durch hochwertige Materialien. "
            "Der Korpus besteht aus beschichteter Spanplatte, die Frontblende aus Eiche furniert.",
        ),
        ("Heading2", "Lieferumfang"),
        ("body", "1 Hängeschrank mit Glastür, Artikelnummer HS-9001/60"),
        ("body", "2 Scharniere (Topfband) und 1 Einlegeboden"),
        ("body", "1 Befestigungsschiene, Art.-Nr. BS-3300"),
        ("Heading2", "Montage"),
        (
            "body",
            "Die Befestigungsschiene waagerecht an der Wand anbringen und den Hängeschrank einhängen. "
            "Das Gewicht des Schranks beträgt 28,5 kg. Bitte nur geeignete Dübel verwenden.",
        ),
        (
            "body",
            "Die Dunstabzugshaube wird erst nach der Nischenrückwand montiert. "
            "Die Arbeitsplatte vor dem Einbau auf Beschädigungen prüfen.",
        ),
        ("Heading2", "Hinweise"),
        ("body", "Vor der Montage den Einlegeboden prüfen. Der Preis beträgt 189,90 EUR inklusive Mehrwertsteuer."),
        ("body", "Bei Fragen wenden Sie sich bitte an Ihren Küchenfachberater."),
    ]
    flow: list[Paragraph | Spacer] = [Paragraph(text, styles[kind] if kind != "body" else body) for kind, text in lines]
    SimpleDocTemplate(str(OUT / "Montageanleitung_Haengeschrank.pdf"), pagesize=A4, title="Montageanleitung").build(
        flow
    )


if __name__ == "__main__":
    manual()
    prices()
    glossary()
    german_pdf()
