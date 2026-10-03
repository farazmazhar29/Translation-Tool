"""Generate fictional demo files in ../samples: `python make_samples.py`."""

from pathlib import Path

from docx import Document
from openpyxl import Workbook

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


manual()
prices()
glossary()
