import urllib.request, json

r = urllib.request.urlopen('http://127.0.0.1:8002/limit-utilisation?currency=INR&fy=All&payment_status=Unpaid&facility_type=LC&lc_status=Open', timeout=10)
data = json.loads(r.read().decode())

banks = data.get('bank_utilization', [])
print('bank_utilization items:')
for b in banks:
    bank_name = b.get('bank')
    print(f'  {bank_name}:')
    for k, v in b.items():
        if v is None:
            print(f'    [NULL] {k}')
        elif k in ('lc_open', 'lc_in_process', 'sblc_utilization', 'cash_utilization', 'interchangeability_limit', 'cash_limit', 'sblc_limit', 'sblc_balance'):
            repr_v = repr(v)
            print(f'    {k} = {repr_v}')

ps = data.get('portfolio_summary', {})
print()
print('portfolio_summary:')
for k, v in ps.items():
    if v is None:
        print(f'  [NULL] {k}')
    elif v == 0:
        print(f'  [ZERO] {k}')
    elif isinstance(v, (int, float)):
        if v != v:  # NaN check
            print(f'  [NaN] {k}')
        else:
            print(f'  {k} = {v!r}')
    else:
        print(f'  {k} = {v!r}')

# Check for NaN in arrays
print()
print('Checking for NaN in bank fields...')
for b in banks:
    for k, v in b.items():
        if isinstance(v, float) and v != v:
            print(f'  NaN found: {b.get("bank")}.{k}')
