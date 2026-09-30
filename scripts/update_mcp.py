import os
import shutil

content = """import os
import json
import requests
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server for Kohl Real Estate Management
mcp = FastMCP("Kohl-Estate-Assistant")

BASE_URL = os.getenv("SUPABASE_URL", "https://kohl.kohlestate-ksa.online/rest/v1")
ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
)

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Accept": "application/json"
}

def _make_get(endpoint: str, params: dict) -> str:
    url = f"{BASE_URL}/{endpoint}"
    try:
        res = requests.get(url, headers=HEADERS, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        return json.dumps(data, ensure_ascii=False, indent=2)
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": str(e), "endpoint": endpoint}, ensure_ascii=False)

@mcp.tool()
def search_properties(query: str = "") -> str:
    \"\"\"ابحث في قائمة العقارات، الصكوك، المدن، والأحياء في قاعدة بيانات مكتب كحل العقاري.\"\"\"
    params = {"select": "*", "limit": "25", "order": "created_at.desc"}
    q = (query or "").strip()
    if q and q != "*":
        params["or"] = f"(property_name.ilike.*{q}*,address.ilike.*{q}*,city.ilike.*{q}*,district.ilike.*{q}*,deed_number.ilike.*{q}*,property_type.ilike.*{q}*)"
    return _make_get("properties", params)

@mcp.tool()
def search_contracts(query: str = "") -> str:
    \"\"\"ابحث في عقود الإيجار والاستثمار (رقم العقد، اسم المستأجر، اسم المؤجر، حالة العقد) في كحل العقاري.\"\"\"
    params = {"select": "*", "limit": "25", "order": "created_at.desc"}
    q = (query or "").strip()
    if q and q != "*":
        params["or"] = f"(contract_number.ilike.*{q}*,tenant_name.ilike.*{q}*,lessor_name.ilike.*{q}*,status.ilike.*{q}*,type.ilike.*{q}*)"
    return _make_get("contracts", params)

@mcp.tool()
def search_customer_orders(query: str = "") -> str:
    \"\"\"ابحث في طلبات وعروض العملاء العقارية (رقم الطلب، اسم العميل، رقم الهاتف، الحي، الفئة) في كحل العقاري.\"\"\"
    params = {"select": "*", "limit": "25", "order": "created_at.desc"}
    q = (query or "").strip()
    if q and q != "*":
        params["or"] = f"(order_number.ilike.*{q}*,customer_name.ilike.*{q}*,customer_phone.ilike.*{q}*,category.ilike.*{q}*,desired_area.ilike.*{q}*,building_type.ilike.*{q}*)"
    return _make_get("customer_orders", params)

@mcp.tool()
def search_lessors(query: str = "") -> str:
    \"\"\"ابحث في سجل الملاك والمؤجرين (الاسم، الهوية/السجل التجاري، رقم الهاتف، البريد).\"\"\"
    params = {"select": "*", "limit": "25", "order": "created_at.desc"}
    q = (query or "").strip()
    if q and q != "*":
        params["or"] = f"(name.ilike.*{q}*,national_id_or_cr.ilike.*{q}*,phone.ilike.*{q}*,email.ilike.*{q}*)"
    return _make_get("lessors", params)

@mcp.tool()
def search_financials(query: str = "") -> str:
    \"\"\"ابحث في العمليات المالية وسجل القيود والمصروفات والإيرادات.\"\"\"
    params = {"select": "*", "limit": "25", "order": "transaction_date.desc"}
    q = (query or "").strip()
    if q and q != "*":
        params["or"] = f"(description.ilike.*{q}*,category.ilike.*{q}*,transaction_type.ilike.*{q}*,payment_method.ilike.*{q}*)"
    return _make_get("financial_transactions", params)

@mcp.tool()
def get_system_overview() -> str:
    \"\"\"احصل على نظرة عامة وإحصائيات سريعة عن حالة المكتب (عدد العقارات، العقود، طلبات العملاء، الملاك، وآخر العمليات).\"\"\"
    overview = {}
    try:
        endpoints = {
            "properties_count": "properties?select=id",
            "contracts_count": "contracts?select=id",
            "orders_count": "customer_orders?select=id",
            "lessors_count": "lessors?select=id",
            "latest_transactions": "financial_transactions?select=transaction_date,transaction_type,amount,description&order=transaction_date.desc&limit=5"
        }
        for key, ep in endpoints.items():
            res = requests.get(f"{BASE_URL}/{ep}", headers=HEADERS, timeout=10)
            if res.ok:
                data = res.json()
                overview[key] = len(data) if "count" in key else data
            else:
                overview[key] = f"HTTP {res.status_code}"
        return json.dumps(overview, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

if __name__ == "__main__":
    mcp.run()
"""

target_path = r"C:\Users\moham\tools\kohl-mcp\mcp_server.py"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"Successfully wrote {target_path}")
