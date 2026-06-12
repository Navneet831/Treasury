import sys
from pathlib import Path

import duckdb
import pytest

# Repo root (GrewAnalytics) must be importable: apps.Treasury.backend.*, packages.contracts
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

WAREHOUSE = r"D:\GrewAnalytics\warehouse.duckdb"


@pytest.fixture(scope="session")
def db():
    """Independent read-only connection for computing expected values."""
    con = duckdb.connect(WAREHOUSE, read_only=True)
    yield con
    con.close()


@pytest.fixture(scope="session")
def datalogic():
    import apps.Treasury.backend.datalogic as dl
    return dl
