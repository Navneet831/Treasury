"""Temporary script: check pgvector extension availability."""
import sys, json
sys.path.insert(0, 'backend')
from apps.Treasury.backend.database import get_repo

repo = get_repo()

rows = repo.fetch_all("SELECT * FROM pg_available_extensions WHERE name = 'vector'")
print('pgvector available:', json.dumps(rows, indent=2))

if rows:
    rows2 = repo.fetch_all("SELECT * FROM pg_extension WHERE extname = 'vector'")
    print('pgvector installed:', json.dumps(rows2, indent=2))
else:
    print('pgvector NOT available in pg_available_extensions')
