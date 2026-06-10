import os
import sys

# Mimic the path setup in backend/run_standalone.py
current_dir = os.getcwd()
grew_analytics_root = os.path.dirname(os.path.dirname(current_dir))
if grew_analytics_root not in sys.path:
    sys.path.insert(0, grew_analytics_root)

try:
    from backend.datalogic import get_treasury_actions
    
    print("Attempting to call get_treasury_actions()...")
    data = get_treasury_actions()
    print("Success!")
    print(f"Actions count: {len(data)}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
