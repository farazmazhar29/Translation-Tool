"""Importing this module registers every table on `Base.metadata` (needed by Alembic and by tooling)."""

from app.accounts import models as accounts
from app.export import models as export
from app.glossary import models as glossary
from app.preferences import models as preferences
from app.projects import models as projects
from app.review import models as review

TABLE_MODULES = (accounts, export, glossary, preferences, projects, review)
