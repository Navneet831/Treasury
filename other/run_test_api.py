import urllib.request
import json

base_url = "http://localhost:8000/api/v1"

def test_endpoint(path):
    print(f"\n--- Testing {path} ---")
    try:
        req = urllib.request.Request(f"{base_url}{path}")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if isinstance(data, list):
                print(f"List with {len(data)} items. First item:")
                print(json.dumps(data[0] if data else [], indent=2)[:500])
            elif isinstance(data, dict):
                print(f"Dictionary keys: {list(data.keys())}")
                for k, v in data.items():
                    if isinstance(v, list):
                        print(f"Key '{k}' -> List with {len(v)} items. First item:")
                        print(json.dumps(v[0] if v else [], indent=2)[:200])
                    else:
                        print(f"Key '{k}' -> {v}")
    except Exception as e:
        print(f"Error: {e}")

test_endpoint("/boe-monitoring?currency=INR")
test_endpoint("/transactions")
test_endpoint("/drill-down?lifecycle_stage=Open%20LC")
test_endpoint("/strategic-intelligence?currency=INR")
