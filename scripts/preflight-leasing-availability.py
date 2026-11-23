"""Read-only deployment evidence. Never starts/stops containers or writes SQL/files."""
import json
import shutil
import subprocess
from pathlib import Path


def run(args, text=None):
    result = subprocess.run(args, input=text, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Read-only command failed; raw output withheld')
    return result.stdout


def query(sql):
    raw = run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-X', '-qAt',
               '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
              "BEGIN READ ONLY; SET LOCAL statement_timeout='15s';\n" + sql + '\nROLLBACK;')
    return json.loads(raw.strip())


def main():
    objects = json.loads(run(['docker', 'inspect', 'kohl_crm_app',
                             'kohl_broker_frontend', 'kohl_account_frontend']))
    by_name = {obj['Name'].lstrip('/'): obj for obj in objects}
    for name, obj in by_name.items():
        if not obj['State']['Running']:
            raise RuntimeError('Container not running: ' + name)
        print(name + ': ' + obj['Image'])
    def env(name):
        return dict(item.split('=', 1) for item in by_name[name]['Config'].get('Env', []) if '=' in item)
    values = {}
    for raw in Path('/home/debian/.config/kohl/hatif.env').read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = (part.strip() for part in line.split('=', 1))
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
            value = value[1:-1]
        if key.startswith('HATIF_'):
            values[key] = value
    required = ('HATIF_WEBHOOK_SECRET', 'HATIF_CLIENT_ID', 'HATIF_CLIENT_SECRET')
    if not all(values.get(key) for key in required):
        raise RuntimeError('Hatif file incomplete')
    if len(values['HATIF_WEBHOOK_SECRET']) < 20 or '•' in values['HATIF_WEBHOOK_SECRET']:
        raise RuntimeError('Hatif secret format invalid')
    live = env('kohl_crm_app')
    if live.get('HATIF_ENABLED') != 'true' or any(live.get(key) != values[key] for key in required):
        raise RuntimeError('Hatif file/live mismatch')
    if env('kohl_account_frontend').get('PASSWORD_RECOVERY_ENABLED') != 'false':
        raise RuntimeError('Account recovery flag changed')
    print('Hatif matches live; account recovery disabled: OK')
    metadata = query("""SELECT json_build_object(
      'availability_migration_present',to_regclass('portal_private.leasing_holds') IS NOT NULL,
      'specialist_role_present',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kohl_leasing'),
      'contracts_total',(SELECT count(*) FROM public.contracts),
      'contract_status_counts',(SELECT coalesce(json_object_agg(state,n),'{}'::json) FROM (SELECT CASE WHEN lower(btrim(status)) IN ('active','draft','expired','terminated') THEN lower(btrim(status)) WHEN status IS NULL THEN 'NULL' ELSE 'OTHER' END state,count(*) n FROM public.contracts GROUP BY 1) grouped),
      'active_contracts', (SELECT count(*) FROM public.contracts WHERE lower(btrim(status))='active'),
      'active_contracts_missing_period',(SELECT count(*) FROM public.contracts WHERE lower(btrim(status))='active' AND (start_date IS NULL OR end_date IS NULL OR end_date<=start_date)),
      'units',(SELECT count(*) FROM portal_private.leasing_units),
      'confirmed_cases_without_contract',(SELECT count(*) FROM portal_private.leasing_cases WHERE stage='CONFIRMED' AND contract_id IS NULL),
      'attachment_columns',(SELECT coalesce(json_agg(table_name||'.'||column_name),'[]'::json) FROM information_schema.columns
       WHERE table_schema='public' AND table_name IN ('contracts','brokerage_agreements') AND column_name='file_url')
    );""")
    print(json.dumps(metadata, ensure_ascii=False))
    if not metadata['specialist_role_present']:
        raise RuntimeError('Required leasing specialist schema missing')
    # Aggregate attachment formats only; never output URLs, filenames, names or identities.
    for table in ('contracts', 'brokerage_agreements'):
        if table + '.file_url' not in metadata['attachment_columns']:
            continue
        counts = query("""SELECT coalesce(json_object_agg(kind,n),'{}'::json) FROM (
          SELECT CASE WHEN file_url IS NULL OR btrim(file_url)='' THEN 'missing'
          WHEN split_part(split_part(btrim(file_url),'?',1),'#',1)='/docs/sample_brokerage.pdf' THEN 'sample_placeholder'
          WHEN btrim(file_url) LIKE '/%%' THEN 'relative_reference'
          WHEN file_url LIKE 'blob:%%' THEN 'temporary_blob_reference'
          WHEN file_url LIKE 'http://%%' THEN 'http_reference'
          WHEN file_url LIKE 'data:application/pdf;%%' THEN 'embedded_pdf'
          WHEN file_url LIKE 'https://%%' THEN 'https_reference'
          ELSE 'other_reference' END kind,count(*) n
          FROM public.%s GROUP BY 1) formats;""" % table)
        print(table + ' attachment formats: ' + json.dumps(counts))
    print('Free disk GiB: %.1f' % (shutil.disk_usage('/home/debian').free / 1024**3))
    print('READ-ONLY PREFLIGHT COMPLETE; no deployment, SQL mutation or file changes.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('STOP: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__) + '; private command output withheld')
