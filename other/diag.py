import urllib.request
import json
import traceback

base_url = "http://localhost:8000/api/v1"

def test_endpoint(path):
    print(f"\n--- Testing {path} ---")
    try:
        req = urllib.request.Request(f"{base_url}{path}")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print("SUCCESS! Response type:", type(data))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()

test_endpoint("/transactions?fy=All")
test_endpoint("/advanced-quant?currency=INR")
