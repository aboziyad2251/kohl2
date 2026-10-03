"""Read-only browser/production comparison. Prints counts and field names, never records.

Usage: python scripts/reconcile-browser-backup.py PATH_TO_PRIVATE_BACKUP
No files or database records are modified. Browser deletion markers are preserved.
"""
import json
import pathlib
import subprocess
import sys

TABLES = {
    'lessors_v1': 'lessors', 'tenants_v1': 'tenants',
    'representatives_v1': 'representatives', 'ownership_documents_v1': 'ownership_documents',
    'properties_v1': 'properties', 'e_poas_v1': 'e_poas', 'contracts_v1': 'contracts',
    'brokerage_agreements_v1': 'brokerage_agreements', 'audit_logs_v1': 'ownership_audit_logs',
    'financial_transactions_v2': 'financial_transactions', 'daily_summaries_v2': 'daily_financial_summaries',
    'ai_reports_v2': 'ai_daily_reports', 'general_services_v1': 'general_services',
    'customer_orders_v1': 'customer_orders', 'managed_properties_v1': 'managed_property_contracts',
    'maintenance_tasks_v1': 'property_maintenance_tasks', 'archived_documents_v1': 'archived_documents',
    'employees_v2': 'employees', 'timesheet_v2': 'timesheet_entries', 'payroll_v2': 'payroll_payments',
    'leaves_v2': 'leave_requests', 'task_delegations_v2': 'task_delegations',
    'crm_leads_v1': 'crm_leads', 'crm_deals_v1': 'crm_deals', 'crm_activities_v1': 'crm_activities',
}


def main():
    backup = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    if backup.get('origin') != 'https://app.kohlestate-ksa.online':
        raise ValueError('Unexpected backup origin')
    data = backup['data']
    deleted = set(json.loads(data.get('kohl_deleted_ids_v1', '[]')))
    # Only fixed, allowlisted table names enter SQL. Raw production rows remain in memory.
    remote = '''import json, subprocess
tables = TABLE_NAMES
out = {}
for table in tables:
    sql = "select to_regclass('public." + table + "') is not null;"
    cmd = ['docker','exec','-i','supabase-db','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At']
    exists = subprocess.run(cmd,input=sql,text=True,capture_output=True,check=True).stdout.strip()
    if exists != 't':
        out[table] = None
        continue
    sql = "select coalesce(json_agg(t), '[]'::json) from public." + table + " t;"
    out[table] = json.loads(subprocess.run(cmd,input=sql,text=True,capture_output=True,check=True).stdout)
print(json.dumps(out))
'''.replace('TABLE_NAMES', repr(list(TABLES.values())))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', 'kohl-vps', 'python3', '-'],
                            input=remote, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError('Read-only server comparison failed; no data changed')
    server = json.loads(result.stdout)
    root = pathlib.Path(__file__).resolve().parents[1]
    # Use the verified live revision: Phase A intentionally removed the legacy seeds.
    seed_result = subprocess.run(['git', 'show', '85dd459:lib/supabaseClient.ts'],
                                 cwd=root, text=True, encoding='utf-8', capture_output=True, check=True)
    seed_source = seed_result.stdout
    report = []
    for key, table in TABLES.items():
        local = json.loads(data.get('kohl_' + key, '[]'))
        if not isinstance(local, list) or any(not isinstance(row, dict) or 'id' not in row for row in local):
            raise ValueError('Invalid record array: ' + key)
        rows = server[table]
        by_id = {str(row['id']): row for row in rows or []}
        local_ids = {str(row['id']) for row in local}
        only = local_ids - by_id.keys()
        differences = set()
        changed = 0
        for row in local:
            saved = by_id.get(str(row['id']))
            if saved is None:
                continue
            fields = {field for field in row.keys() & saved.keys()
                      if field not in {'created_at', 'updated_at'} and row[field] != saved[field]}
            changed += bool(fields)
            differences.update(fields)
        report.append(dict(table=table, browser=len(local), server=None if rows is None else len(rows),
                           browser_only=len(only), shared_different=changed,
                           differing_fields=sorted(differences),
                           browser_only_seed_id_matches=sum(("'" + record_id + "'") in seed_source or ('"' + record_id + '"') in seed_source for record_id in only),
                           server_marked_deleted=len(by_id.keys() & deleted)))
    print(json.dumps({'deletion_markers': len(deleted), 'tables': report,
                      'limitations': 'Shared fields compared without type/date normalization; seed ID matches require review. No automatic merge or deletion.'}, indent=2))


if __name__ == '__main__':
    main()
