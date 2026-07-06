import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
print(f"API Key present: {bool(api_key)}")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

try:
    response = client.chat.completions.create(
        model="deepseek/deepseek-r1",
        messages=[
            {"role": "user", "content": "Hello, are you there?"}
        ]
    )
    print("Response successful!")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
