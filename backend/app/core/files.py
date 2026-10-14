"""Uploaded and exported files live in the database; the disk only holds a working copy.

Hosts with an ephemeral disk (Render's free tier) wipe `DATA_DIR` on every restart. Parsing, the Excel table view
and the exports need the file on disk, so it is written back from the database copy whenever it is missing.
"""

from pathlib import Path


def on_disk(path: Path, data: bytes | None) -> Path:
    """`path`, restored from `data` (the copy in the database) when the disk no longer has it."""
    if not path.exists() and data:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return path
