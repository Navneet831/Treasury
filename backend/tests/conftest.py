import sys
import os
import types
from pathlib import Path

# Repo root is the parent of backend/
backend_dir = Path(__file__).resolve().parent.parent
treasury_root = backend_dir.parent

# Set up mock modules so apps.Treasury... and packages... imports work
if 'apps' not in sys.modules:
    apps = types.ModuleType('apps')
    apps.__path__ = []
    sys.modules['apps'] = apps

if 'apps.Treasury' not in sys.modules:
    treasury = types.ModuleType('apps.Treasury')
    treasury.__path__ = [str(treasury_root)]
    sys.modules['apps.Treasury'] = treasury

if 'packages' not in sys.modules:
    pkgs = types.ModuleType('packages')
    pkgs.__path__ = []
    sys.modules['packages'] = pkgs

if 'packages.contracts' not in sys.modules:
    contracts = types.ModuleType('packages.contracts')
    sys.modules['packages.contracts'] = contracts
    contracts.IRepository = type('IRepository', (object,), {})
    contracts.PlatformModule = type('PlatformModule', (object,), {})

# Load environment variables for stand-alone database connection
from dotenv import load_dotenv
load_dotenv(os.path.join(str(treasury_root), '.env'), override=True)

import pytest

@pytest.fixture(scope="session")
def db():
    """Independent read-only connection for computing expected values on PostgreSQL."""
    from apps.Treasury.backend.database import get_repo
    repo = get_repo()
    
    class DbWrapper:
        def execute(self, query: str, params=None):
            # Translate DuckDB dialect to PostgreSQL
            q = repo._translate(query)
            # Create a standard tuple cursor (returning tuples, matching DuckDB fetchall behavior)
            cur = repo._con.cursor()
            if params:
                cur.execute(q, list(params) if not isinstance(params, (list, tuple)) else params)
            else:
                cur.execute(q.replace("%", "%%"))
                
            class CursorWrapper:
                def __init__(self, c):
                    self._c = c
                def fetchall(self):
                    from decimal import Decimal
                    rows = self._c.fetchall()
                    return [
                        tuple(float(x) if isinstance(x, Decimal) else x for x in row)
                        for row in rows
                    ]
                def fetchone(self):
                    from decimal import Decimal
                    row = self._c.fetchone()
                    if row:
                        return tuple(float(x) if isinstance(x, Decimal) else x for x in row)
                    return None
            return CursorWrapper(cur)

    yield DbWrapper()


@pytest.fixture(scope="session")
def datalogic():
    import apps.Treasury.backend.datalogic as dl
    return dl
