"""Write the Swagger/OpenAPI schema for the frontend type generator: `python export_openapi.py`."""

import json
from pathlib import Path

from app.main import app

Path(__file__).resolve().parents[1].joinpath("frontend", "openapi.json").write_text(
    json.dumps(app.openapi(), indent=1), encoding="utf-8"
)
