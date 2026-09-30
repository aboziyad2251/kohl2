import json
import os

appdata = os.getenv("APPDATA")
config_path = os.path.join(appdata, "Claude", "claude_desktop_config.json")

os.makedirs(os.path.dirname(config_path), exist_ok=True)

config = {
    "mcpServers": {
        "kohl-estate": {
            "command": "C:/Users/moham/tools/kohl-mcp/.venv/Scripts/python.exe",
            "args": [
                "C:/Users/moham/tools/kohl-mcp/mcp_server.py"
            ],
            "env": {
                "SUPABASE_URL": "https://kohl.kohlestate-ksa.online/rest/v1",
                "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
                "PYTHONIOENCODING": "utf-8"
            }
        }
    }
}

with open(config_path, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=4, ensure_ascii=False)

print(f"Successfully updated Claude Desktop config at: {config_path}")
