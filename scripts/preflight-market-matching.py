"""Read-only matching deployment prerequisites. Never prints runtime secrets."""
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
LIVE={
 'kohl_crm_app':'sha256:9bae346387ec38d2eadf79360e67bdb5a5078a2acc2c32711a1b7d275d3a078e',
 'kohl_broker_frontend':'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
 'kohl_account_frontend':'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850',
}
SQL="""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT json_build_object(
 'matching_not_installed',to_regprocedure('public.market_workspace(text,jsonb)') IS NULL
 AND to_regclass('portal_private.market_requests') IS NULL AND to_regclass('portal_private.market_listings') IS NULL AND to_regclass('portal_private.market_feedback') IS NULL,
 'availability_present',to_regprocedure('public.leasing_unit_availability(date,date)') IS NOT NULL,
 'required_columns_present',NOT EXISTS(
 SELECT 1 FROM (VALUES
 ('public','customer_orders','id'),('public','customer_orders','customer_name'),('public','customer_orders','order_number'),('public','customer_orders','notes'),('public','customer_orders','status'),
 ('public','properties','id'),('public','properties','property_name'),('public','properties','city'),('public','properties','address'),
 ('public','contracts','property_id'),('public','contracts','status'),('public','contracts','start_date'),('public','contracts','end_date'),
 ('portal_private','leasing_units','id'),('portal_private','leasing_units','property_id'),('portal_private','leasing_units','code'),
 ('portal_private','accounts','user_id'),('portal_private','accounts','is_active'),('portal_private','accounts','role')) required(s,t,c)
 WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns actual WHERE actual.table_schema=required.s AND actual.table_name=required.t AND actual.column_name=required.c)),
 'catalog_within_limit',(SELECT count(*)<=2000 FROM public.properties) AND (SELECT count(*)<=2000 FROM public.customer_orders),
 'designated_reviewers_active',EXISTS(SELECT 1 FROM portal_private.operations_approval_config c JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active WHERE c.singleton)
);
ROLLBACK;"""

def main():
 spec=importlib.util.spec_from_file_location('market_readonly_helpers',ROOT/'scripts/prepare-leasing-specialist-release.py')
 base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 originals={name:base.inspect(name) for name in LIVE}
 for name,obj in originals.items():
  if obj['Image']!=LIVE[name] or not obj['State']['Running']:raise RuntimeError('Live checkpoint changed')
  print(name+': '+obj['Image'])
 base.candidate_runtime(originals['kohl_crm_app'],LIVE['kohl_crm_app'])
 if base.env(originals['kohl_account_frontend']).get('PASSWORD_RECOVERY_ENABLED')!='false':raise RuntimeError('Recovery flag changed')
 if base.inspect('supabase-db')['Image']!=base.restore.IMAGE:raise RuntimeError('Database image changed')
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=SQL,text=True,capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError('Read-only schema query failed; raw output withheld')
 flags=json.loads(result.stdout)
 for key,value in flags.items():print(key+': '+('OK' if value is True else 'NEEDS REVIEW'))
 if not flags or not all(v is True for v in flags.values()):raise RuntimeError('Prerequisites need review')
 print('MARKET MATCHING PREFLIGHT OK; Hatif preserved; recovery disabled; no production changes.')

if __name__=='__main__':
 try:main()
 except Exception as error:raise SystemExit('STOP: matching preflight failed ('+type(error).__name__+'); do not deploy')
