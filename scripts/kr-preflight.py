"""Read-only host/schema check. Run with sudo -n python3 on the existing Debian VPS.
Never prints runtime environment values, customer records or database contents.
"""
import json
import subprocess

def capture(*args):
    return subprocess.check_output(args, text=True).strip()

print(capture('docker', 'inspect', 'kohl_crm_app', '--format',
              'image={{.Image}} running={{.State.Running}} restarts={{.RestartCount}}'))
print('Current Compose files:', capture('docker', 'inspect', 'kohl_crm_app', '--format',
      '{{index .Config.Labels "com.docker.compose.project.config_files"}}'))
required = {
    'public.properties': 'id property_name property_type property_kind property_use city address units_count spreadsheet_details lessor_id',
    'public.contracts': 'id status is_archived',
    'public.brokerage_agreements': 'id ejar_status is_archived',
    'public.e_poas': 'id status expiry_date',
    'public.financial_transactions': 'id transaction_date transaction_type amount tax_vat net_profit',
    'public.crm_activities': 'id activity_type title notes status due_date created_at created_by_name lead_id lead_or_client_name',
    'public.crm_leads': 'id name phone lead_type priority budget_max notes created_at',
    'public.task_delegations': 'id title status due_date notes description assigned_to_name',
    'public.managed_property_contracts': 'id status vacant_units property_type',
    'portal_private.accounts': 'user_id full_name role is_active',
    'portal_private.hatif_events': 'activity_id',
}
sql = "BEGIN READ ONLY; SELECT table_schema||'.'||table_name||'.'||column_name FROM information_schema.columns WHERE table_schema IN ('public','portal_private'); ROLLBACK;"
columns = set(capture('docker', 'exec', 'supabase-db', 'psql', '-U', 'postgres', '-d',
                      'postgres', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql).splitlines())
missing = [table + '.' + column for table, fields in required.items()
           for column in fields.split() if table + '.' + column not in columns]
if missing:
    print(json.dumps({'missing_source_columns': missing}, ensure_ascii=False, indent=2))
    raise SystemExit('STOP: review the current schema before applying the new migration.')
print('Required source columns: PASS')
print('Read-only preflight complete. No migration, records or containers changed.')
print('Next: review ONLY 20261026115017_kr_property_workflow.sql and the KR runbook.')
