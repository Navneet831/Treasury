"""Check pgvector installation options."""
import os, sys, types
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
treasury_dir = os.path.dirname(current_dir)
grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

for path in [grew_analytics_root, treasury_dir, current_dir]:
    env_file = os.path.join(path, '.env')
    if os.path.exists(env_file):
        load_dotenv(dotenv_path=env_file, override=True)

sys.path.insert(0, grew_analytics_root)

# Mock modules
for mod_name, mod_path in [('apps', []), ('packages', [])]:
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

# Check superuser status
rows = repo.fetch_all("SELECT current_user, current_database(), inet_server_addr(), inet_server_port()")
print('Session info:', rows)

# Check if we can create extensions
rows = repo.fetch_all("SELECT rolcreatedb, rolcreaterole, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = current_user")
print('Role caps:', rows)

# Show all available extensions
rows = repo.fetch_all("SELECT name, default_version, installed_version, comment FROM pg_available_extensions ORDER BY name")
print('All available extensions:', [(r['name'], r['default_version'], r['installed_version']) for r in rows[:20]])

# Check shared libraries
try:
    rows = repo.fetch_all("SELECT name, setting FROM pg_settings WHERE name = 'shared_preload_libraries'")
    print('Shared preload libs:', rows)
except Exception as e:
    print(f'Cannot check shared preload: {e}')

# Try to check OS-level pgvector availability
try:
    rows = repo.fetch_all("SELECT * FROM pg_file_settings WHERE name LIKE '%pgvector%'")
    print('pgvector in file settings:', rows)
except Exception as e:
    print(f'Cannot check file settings: {e}')
