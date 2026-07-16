import sys, os, types
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
treasury_root = backend_dir.parent

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

from dotenv import load_dotenv
load_dotenv(os.path.join(str(treasury_root), '.env'), override=True)

import apps.Treasury.backend.datalogic as dl

# 1. Get ALL data (no FY filter)
all_res = dl.get_interest_summary_data()
print("=== Months available (no filter) === ordered from response:")
for m in all_res["months"]:
    print(f"  {m}")

print(f"\nFYs available: {all_res['fyList']}")
print(f"Total rows across all FYs: {len(all_res['rows'])} (for {all_res['rows'][0]['account'] if all_res['rows'] else 'N/A'})")

# 2. Get FY26-27 only
fy_res = dl.get_interest_summary_data(fy="FY26-27")
print(f"\n=== FY26-27 filtered ===")
print(f"Months in FY26-27: {fy_res['months']}")
print(f"Rows: {len(fy_res['rows'])}")
for r in fy_res["rows"]:
    if "43478784435" in str(r["account"]):
        print(f"  {r['monthKey']:10s} closingBal={r['closingBal']:>15,.2f}")

# 3. Simulate frontend month filtering: show months in descending order
print(f"\n=== FY26-27 months sorted descending (newest first) ===")
short_months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
def parse_mk(mk):
    parts = mk.split('_')
    month_idx = short_months.index(parts[0].lower())
    yr = 2000 + int(parts[1])
    return yr * 12 + month_idx

sorted_months = sorted(fy_res['months'], key=parse_mk, reverse=True)
for m in sorted_months:
    rows = [r for r in fy_res['rows'] if r['monthKey'] == m and "43478784435" in str(r['account'])]
    for r in rows:
        print(f"  {m:10s} closingBal={r['closingBal']:>15,.2f}")

# 4. Verify: if jun_26 selected, only jun_26 rows returned
print(f"\n=== jun_26 only ===")
jun_rows = [r for r in fy_res['rows'] if r['monthKey'] == 'jun_26' and "43478784435" in str(r['account'])]
for r in jun_rows:
    print(f"  account={r['account']} month={r['monthKey']} closingBal={r['closingBal']:,.2f}")
print(f"Count for jun_26: {len(jun_rows)} (should be 1 per account)")
