import urllib.request
import json

data = json.dumps({"query": "Show unpaid bills"}).encode('utf-8')
req = urllib.request.Request("http://127.0.0.1:8000/api/treasury/ai-copilot", data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        result = response.read()
        print("Success:")
        print(result.decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
