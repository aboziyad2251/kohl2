"""Read-only VPS prerequisites for the separate leasing account. Prints no secrets.
Does not build, back up, migrate, stop, rename or restart anything.
"""
import ast
import copy
import json
import pathlib
import subprocess

ROOT=pathlib.Path(__file__).resolve().parent.parent
LIVE={
 'kohl_crm_app':'sha256:cc84170de3567a868a6c9605b526744705dc58f469f3055545f2e6e0c5f639a3',
 'kohl_broker_frontend':'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
 'kohl_account_frontend':'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850',
}
SQL="""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT jsonb_build_object(
 'designated_reviewers_active',EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
  JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
  JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active),
 'new_account_migration_absent',to_regclass('portal_private.leasing_specialist_config') IS NULL
  AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kohl_leasing'),
 'auth_sessions_available',to_regclass('auth.sessions') IS NOT NULL,
 'account_role_constraint_available',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='portal_private.accounts'::regclass AND conname='accounts_role_check'),
 'deployed_operations_core_available',to_regprocedure('portal_private.operations_core_v1(text,jsonb)') IS NOT NULL,
 'no_public_business_table_grants',NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE n.nspname IN ('public','portal_private') AND c.relkind IN ('r','p','v','m') AND a.grantee=0),
 'no_public_definer_execution',NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE n.nspname='public' AND p.prosecdef AND a.grantee=0 AND a.privilege_type='EXECUTE')
);
ROLLBACK;"""

def output(args, **kwargs):
 result=subprocess.run(args,capture_output=True,text=True,check=True,timeout=30,**kwargs)
 return result.stdout.strip()

def main():
 stage='source'
 try:
  if output(['git','-C',str(ROOT),'status','--porcelain','--untracked-files=no']):
   raise RuntimeError('Source has tracked changes')
  print('Source: '+output(['git','-C',str(ROOT),'rev-parse','HEAD']))
  stage='live containers'
  originals={name:json.loads(output(['docker','inspect',name]))[0] for name in LIVE}
  if any(not obj['State']['Running'] or obj['Image']!=LIVE[name] for name,obj in originals.items()):
   raise RuntimeError('Live checkpoint changed')
  print('Live main/broker/account checkpoint: OK')
  stage='Hatif preservation'
  tree=ast.parse((ROOT/'scripts/release-broker-ui.py').read_text())
  node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='prepare_hatif_runtime')
  scope={'copy':copy,'pathlib':pathlib}
  exec(compile(ast.Module(body=[node],type_ignores=[]),'pure-hatif-preflight','exec'),scope)
  before=copy.deepcopy(originals['kohl_crm_app'])
  candidate=scope['prepare_hatif_runtime'](before,pathlib.Path('/home/debian/.config/kohl/hatif.env'))
  def env(obj):return dict(item.split('=',1) for item in obj['Config'].get('Env',[]))
  if env(candidate)!=env(originals['kohl_crm_app']):raise RuntimeError('Private Hatif reconciliation required')
  print('Hatif file validated and matches live: OK')
  stage='read-only database prerequisites'
  flags=json.loads(output(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=SQL))
  for label,ok in flags.items():print(label+': '+('OK' if ok is True else 'NEEDS REVIEW'))
  if not flags or any(value is not True for value in flags.values()):raise RuntimeError('Database prerequisites need review')
  print('LEASING PREFLIGHT OK; no deployment or production changes.')
 except Exception as error:
  print('STOP: read-only preflight failed at '+stage+' ('+type(error).__name__+').')
  print('Production unchanged; do not use a historical deployment script.')
  raise SystemExit(1)
if __name__=='__main__':main()
