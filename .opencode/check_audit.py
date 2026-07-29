import json
with open(r'D:\tmp\Treasury\.opencode\audit_catalog_sample.json') as f:
    d = json.load(f)
print('Keys:', list(d.keys()))
print('Metrics count:', len(d.get('metrics',[])))
print('Config count:', len(d.get('config',[])))
print('DataSources count:', len(d.get('data_sources',[])))
print('Conventions count:', len(d.get('conventions',[])))
print()
print('=== Data Sources ===')
for ds in d.get('data_sources',[]):
    print(f'  Table: {ds["table"]:30s} rows: {ds.get("row_count")}')
print()
print('=== Sample Metrics (first 5) ===')
for m in d.get('metrics',[])[:5]:
    src = m.get('source','MISSING!')
    print(f'  ID: {m["id"]:25s} source: {src[:60]}')
# Now check for metricIds that might have no 'source' field
missing_source = [m['id'] for m in d.get('metrics',[]) if not m.get('source')]
print()
if missing_source:
    print(f'!!! {len(missing_source)} metrics MISSING source field: {missing_source}')
else:
    print('All metrics have source field ✓')
