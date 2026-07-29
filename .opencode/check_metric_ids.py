import json

with open(r'D:\tmp\Treasury\.opencode\audit_catalog_sample.json') as f:
    d = json.load(f)

metrics = {m['id']: m for m in d['metrics']}

# All metricIds used across all views
ids = [
    'int-health','int-runway','int-ewi','int-lar','int-yield-lost',
    'int-inefficiency','fx-loss','int-stress-prob','int-closure',
    'int-demand','int-dependency','int-stress-window',
    'fx-exposure','fx-unhedged','fx-hedge-book',
    'cf-monthly',
    'ops-funnel','ops-delayed',
]

print('=== Metric ID Matching Check ===')
all_found = True
for mid in ids:
    found = mid in metrics
    if not found:
        all_found = False
    src = metrics[mid]['source'][:60] if found else ''
    status = 'OK' if found else 'MISSING'
    print(f'  [{status}] {mid:25s}  {src}')

print(f'\nAll IDs matched: {all_found}')
print(f'Total metrics: {len(metrics)}')
