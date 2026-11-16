"""Read-only VPS prerequisites for a restricted operations employee; no account creation."""
import argparse
import json
import subprocess

SQL = """BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT json_build_object(
 'auth_email_matches',(SELECT count(*) FROM auth.users WHERE lower(email)=lower(:'email')),
 'staff_email_matches',(SELECT count(*) FROM public.employees WHERE lower(email)=lower(:'email')),
 'existing_account_roles',coalesce((SELECT json_agg(a.role) FROM portal_private.accounts a JOIN auth.users u ON u.id=a.user_id WHERE lower(u.email)=lower(:'email')),'[]'::json),
 'existing_accounts_active',coalesce((SELECT json_agg(a.is_active) FROM portal_private.accounts a JOIN auth.users u ON u.id=a.user_id WHERE lower(u.email)=lower(:'email')),'[]'::json),
 'approval_reviewers_active',EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
 JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
 JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active),
 'leasing_switch_installed',to_regprocedure('public.leasing_switch_admin(uuid,text,jsonb)') IS NOT NULL,
 'operations_core_installed',to_regprocedure('portal_private.operations_core_v1(text,jsonb)') IS NOT NULL);
SELECT json_build_object('account_columns',json_agg(column_name ORDER BY ordinal_position))
 FROM information_schema.columns WHERE table_schema='portal_private' AND table_name='accounts';
SELECT json_build_object('table',c.relname,'rls',c.relrowsecurity,'policies',
 (SELECT json_agg(json_build_object('name',p.policyname,'roles',p.roles,'command',p.cmd,'using',p.qual,'check',p.with_check))
 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('employees','timesheet_entries','payroll_payments','leave_requests','task_delegations','archived_documents','financial_transactions','properties')
 ORDER BY c.relname;
ROLLBACK;
"""

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--email',required=True)
 args=parser.parse_args()
 if '@' not in args.email or len(args.email)>254 or any(ord(c)<32 for c in args.email):
  raise SystemExit('STOP: invalid email')
 for name in ('kohl_crm_app','kohl_broker_frontend','kohl_account_frontend'):
  result=subprocess.run(['docker','inspect',name,'--format','{{.State.Status}} {{.Image}}'],capture_output=True,text=True)
  if result.returncode:raise SystemExit('STOP: container checkpoint unavailable')
  print(name+': '+result.stdout.strip())
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','email='+args.email],input=SQL,capture_output=True,text=True,timeout=60)
 if result.returncode:raise SystemExit('STOP: database prerequisites unavailable; no account created')
 for line in result.stdout.splitlines():
  print(json.dumps(json.loads(line),ensure_ascii=False))
 print('OPERATIONS EMPLOYEE INSPECTION OK; read only; no account or production changes.')

if __name__=='__main__':main()
