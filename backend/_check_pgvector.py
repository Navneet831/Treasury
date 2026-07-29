"""Check pgvector availability. Replicates run_standalone.py path setup."""
import os, sys, json, types
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
treasury_dir = os.path.dirname(current_dir)
grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

# Load .env files (same as run_standalone.py)
for path in [grew_analytics_root, treasury_dir, current_dir]:
    env_file = os.path.join(path, '.env')
    if os.path.exists(env_file):
        load_dotenv(dotenv_path=env_file, override=True)

sys.path.insert(0, grew_analytics_root)

# Mock modules (same as run_standalone.py)
for mod_name, mod_path in [
    ('apps', []),
    ('packages', []),
]:
    if mod_name not in sys.modules:
        m = types.ModuleType(mod_name)
        m.__path__ = mod_path
        sys.modules[mod_name] = m

if 'apps.Treasury' not in sys.modules:
    treasury_mod = types.ModuleType('apps.Treasury')
    treasury_mod.__path__ = [treasury_dir]
    sys.modules['apps.Treasury'] = treasury_mod

if 'packages.contracts' not in sys.modules:
    contracts = types.ModuleType('packages.contracts')
    sys.modules['packages.contracts'] = contracts
    contracts.IRepository = type('IRepository', (object,), {})
    contracts.PlatformModule = type('PlatformModule', (object,), {})

from apps.Treasury.backend.database import get_repo
repo = get_repo()

# Check pgvector extension
rows = repo.fetch_all("SELECT * FROM pg_available_extensions WHERE name = 'vector'")
print('pgvector available:', json.dumps(rows, indent=2))

if rows:
    rows2 = repo.fetch_all("SELECT * FROM pg_extension WHERE extname = 'vector'")
    print('pgvector installed:', json.dumps(rows2, indent=2))
else:
    print('pgvector NOT available in pg_available_extensions')

# Check PostgreSQL version
ver = repo.fetch_one("SELECT version()")
print('PG version:', ver)
