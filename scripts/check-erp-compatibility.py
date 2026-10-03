"""Read-only ERP write/schema preflight. Prints schema differences, never rows or secrets.

Run on the VPS from the release checkout: python3 scripts/check-erp-compatibility.py
Exit 1 means the application has incompatible write payloads; do not cut over.
"""
import json
import pathlib
import re
import subprocess
import sys
import os

root = pathlib.Path(__file__).resolve().parents[1]
database = os.environ.get('PORTAL_CHECK_DATABASE', 'postgres')
if database != 'postgres' and not re.fullmatch(r'kohl_[a-z0-9_]+', database):
    raise ValueError('Unexpected database name')
source = (root / 'lib/services/dbService.ts').read_text(encoding='utf-8')
query = """
select coalesce(json_agg(json_build_object(
 'table',table_name,'column',column_name,'required',is_nullable='NO' and column_default is null
)), '[]'::json) from information_schema.columns where table_schema='public';
"""
result = subprocess.run(
    ['docker','exec','-i','supabase-db','psql','-X','-U','postgres','-d',database,
     '-v','ON_ERROR_STOP=1','-At'], input=query, text=True, capture_output=True)
if result.returncode:
    print('Unable to inspect production schema; no compatibility result available.')
    sys.exit(2)
catalog = {}
for row in json.loads(result.stdout):
    catalog.setdefault(row['table'], {})[row['column']] = row['required']

payloads = re.findall(
    r"\.from\('([^']+)'\)\s*\.(insert|update)\(\s*\[?\s*\{([^{}]*)\}\s*,?\s*\]?\s*\)",
    source, re.S)
if not payloads:
    print('No write payloads detected; manual review required.')
    sys.exit(2)
issues = set()
for table, operation, body in payloads:
    fields = set(re.findall(r'^\s*(\w+)\s*:', body, re.M))
    if table not in catalog:
        issues.add(f'{table}: table missing')
        continue
    missing = fields - catalog[table].keys()
    if missing:
        issues.add(f'{table}: unknown write fields: {", ".join(sorted(missing))}')
    if operation == 'insert':
        required = {name for name, needed in catalog[table].items() if needed}
        absent = required - fields
        if absent:
            issues.add(f'{table}: required insert fields absent: {", ".join(sorted(absent))}')
for issue in sorted(issues):
    print(issue)
print(f'Checked {len(payloads)} write payloads; {len(issues)} structural compatibility issues.')
print('This check does not verify value constraints, data conversion, RLS, or browser-only records.')
sys.exit(1 if issues else 0)
