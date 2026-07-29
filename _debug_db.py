import sys, os, types, time

current_dir = os.path.dirname(os.path.abspath('backend/run_standalone.py'))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
if grew_analytics_root not in sys.path:
    sys.path.insert(0, grew_analytics_root)

# Mock modules
if 'apps' not in sys.modules:
    apps = types.ModuleType('apps'); apps.__path__ = []; sys.modules['apps'] = apps
if 'apps.Treasury' not in sys.modules:
    t = types.ModuleType('apps.Treasury'); t.__path__ = [os.path.dirname(current_dir)]; sys.modules['apps.Treasury'] = t
if 'packages' not in sys.modules:
    p = types.ModuleType('packages'); p.__path__ = []; sys.modules['packages'] = p
if 'packages.contracts' not in sys.modules:
    c = types.ModuleType('packages.contracts'); sys.modules['packages.contracts'] = c
    c.IRepository = type('IRepository', (object,), {})
    c.PlatformModule = type('PlatformModule', (object,), {})

from dotenv import load_dotenv
load_dotenv(dotenv_path='.env', override=True)

from apps.Treasury.backend.database import get_repo
repo = get_repo()
print(f'DB connected: {type(repo).__name__}')

# Quick check
r = repo.fetch_all('SELECT 1 as ok')
print(f'SELECT 1: {r}')

# Test each table
tables = ['LC', 'bank_limit', 'SBLC', 'FDR_List', 'Bank_Guarantee', 'LC BG in Process']
for t in tables:
    try:
        start = time.time()
        r = repo.fetch_all(f'SELECT COUNT(*) as cnt FROM "{t}"')
        elapsed = time.time() - start
        print(f'{t}: {r[0]["cnt"]} rows ({elapsed:.1f}s)')
    except Exception as e:
        print(f'{t}: ERROR - {e}')
