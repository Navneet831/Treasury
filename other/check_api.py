import urllib.request, json

# Check command-data
r = urllib.request.urlopen('http://127.0.0.1:8002/command-data?currency=INR&fy=All', timeout=10)
data = json.loads(r.read().decode())
print('=== COMMAND DATA ===')
for k, v in data.items():
    if v is None:
        print(f'  NULL: {k}')
    elif isinstance(v, list):
        print(f'  Array: {k} (len={len(v)})')
    elif isinstance(v, dict):
        print(f'  Dict: {k} keys={list(v.keys())}')

# Check limit-utilisation  
r = urllib.request.urlopen('http://127.0.0.1:8002/limit-utilisation?currency=INR&fy=All&payment_status=Unpaid&facility_type=LC&lc_status=Open', timeout=10)
data = json.loads(r.read().decode())
print('\n=== LIMIT UTILISATION ===')
for k, v in data.items():
    if v is None:
        print(f'  NULL: {k}')
    elif isinstance(v, list):
        print(f'  Array: {k} (len={len(v)})')
        if k == 'bank_utilization' and len(v) > 0:
            for b in v:
                nulls = [kk for kk, vv in b.items() if vv is None]
                if nulls:
                    print(f'    Bank {b.get("bank")}: NULL fields = {nulls}')
                else:
                    print(f'    Bank {b.get("bank")}: all OK')
    elif isinstance(v, dict):
        print(f'  Dict: {k} keys={list(v.keys())}')
        nulls = [kk for kk, vv in v.items() if vv is None]
        if nulls:
            print(f'    NULL fields: {nulls}')
