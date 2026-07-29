import urllib.request, json

# Check command-data summary
r = urllib.request.urlopen('http://127.0.0.1:8002/command-data?currency=INR&fy=All', timeout=10)
data = json.loads(r.read().decode())
print('=== COMMAND DATA SUMMARY ===')
s = data.get('summary', {})
for k, v in s.items():
    print(f'  {k} = {v!r} (type={type(v).__name__})')

print()
print('=== boe_status_bank_pivot ===')
pivot = data.get('boe_status_bank_pivot', [])
for row in pivot:
    print(f'  {row}')

print()
print('=== product_unpaid_pivot ===')
pup = data.get('product_unpaid_pivot', [])
for row in pup:
    print(f'  {row}')
