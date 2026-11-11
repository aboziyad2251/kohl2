"""Prepare a private deployment plan only. No SQL writes or container mutations."""
import argparse
import ast
import copy
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile

ROOT=pathlib.Path(__file__).resolve().parent.parent
SOURCE='e3a3eb7e9f3a2b09811d8c7e3d17c705ff68e040'
CANDIDATE='sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506'
LIVE={
 'kohl_crm_app':'sha256:14c18128ae6221523b4a1804be05f994dc389e7967e13764a47d9e055e14373a',
 'kohl_broker_frontend':'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
 'kohl_account_frontend':'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850',
}
MIGRATIONS=('20261110143135_leasing_internal_finance.sql','20261110215449_operations_private_documents.sql')

def inspect(name, image=False):
    cmd=['docker','image','inspect',name] if image else ['docker','inspect',name]
    result=subprocess.run(cmd,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Docker inspection failed')
    return json.loads(result.stdout)[0]

def prepare_runtime(old, path):
    # Extract only the reusable pure helper; never execute the historical release script.
    source=(ROOT/'scripts/release-broker-ui.py').read_text()
    node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='prepare_hatif_runtime')
    scope={'copy':copy,'pathlib':pathlib}
    exec(compile(ast.Module(body=[node],type_ignores=[]),'hatif-preflight','exec'),scope)
    candidate=scope['prepare_hatif_runtime'](old,path)
    before=dict(x.split('=',1) for x in old['Config'].get('Env',[]) if '=' in x)
    after=dict(x.split('=',1) for x in candidate['Config'].get('Env',[]) if '=' in x)
    # A stale env file must never overwrite newly rotated live secrets.
    if before != after:
        raise RuntimeError('Runtime/env-file mismatch: reconcile privately before deployment')
    candidate['Config']['Image']=CANDIDATE
    return candidate

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rehearsal-receipt',required=True,type=pathlib.Path)
    args=parser.parse_args()
    os.umask(0o077)
    receipt=json.loads(args.rehearsal_receipt.read_text())
    hashes={n:hashlib.sha256((ROOT/'supabase/migrations'/n).read_bytes()).hexdigest() for n in MIGRATIONS}
    if receipt.get('migrations')!=hashes or receipt.get('production_changed') is not False:
        raise RuntimeError('Restore rehearsal does not match the candidate migrations')
    if not pathlib.Path(receipt['backup']).is_file():
        raise RuntimeError('Rehearsed backup is missing')
    originals={name:inspect(name) for name in LIVE}
    for name,old in originals.items():
        if old['Image']!=LIVE[name] or not old['State']['Running']:
            raise RuntimeError('Live container changed or stopped; re-review before planning')
    if inspect(CANDIDATE,True)['Id']!=CANDIDATE:
        raise RuntimeError('Candidate image does not match the tested image')
    old=originals['kohl_crm_app']
    prepared=prepare_runtime(old,pathlib.Path('/home/debian/.config/kohl/hatif.env'))
    # A future dispatcher must explicitly reuse mounts; no anonymous mount replacement.
    if old.get('Mounts'):
        raise RuntimeError('Main container has mounts: review preservation before cutover')
    query="""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT to_regprocedure('public.kohl_operations(text,jsonb)') IS NULL
 AND to_regprocedure('public.operations_document(uuid,text,jsonb)') IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='portal_private'
 AND tablename IN ('leasing_cases','leasing_units','leasing_followups',
 'internal_dues','internal_installments','internal_entries','operations_documents',
 'operations_history','operations_replays','operations_exports'))
 AND NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='kohl-finance-documents');
ROLLBACK;"""
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres',
                           '-d','postgres','-v','ON_ERROR_STOP=1'],
                          input=query,text=True,capture_output=True)
    if result.returncode or result.stdout.strip()!='t':
        raise RuntimeError('Production schema preflight differs; inspect before deployment')
    base=pathlib.Path('/home/debian/backups')
    base.mkdir(parents=True,exist_ok=True)
    target=pathlib.Path(tempfile.mkdtemp(prefix='kohl-operations-plan-',dir=base))
    (target/'runtime-original.private.json').write_text(json.dumps(originals,indent=2))
    (target/'runtime-candidate.private.json').write_text(json.dumps(prepared,indent=2))
    plan={'source':SOURCE,'image':CANDIDATE,'previous_images':LIVE,
          'migration_hashes':hashes,'restore_receipt':str(args.rehearsal_receipt.resolve()),
          'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'hatif_file_matches_live':True,'fresh_db_backup_required_before_apply':True,
          'target':'kohl_crm_app','preserve_frontends':['kohl_broker_frontend','kohl_account_frontend'],
          'rollback':'Restore old main container; retain additive schema/data. Never automatically restore a stale database dump.',
          'mode':'PREPARE_ONLY'}
    (target/'plan.json').write_text(json.dumps(plan,indent=2))
    print('PREPARATION OK: tested image and migrations pinned; Hatif preserved; live containers unchanged.')
    print('Private plan directory: '+str(target))
    print('Do not share runtime JSON files; they contain secrets.')
    print('No deployment or production migration performed. Reviewed apply/rollback dispatcher still required.')

if __name__=='__main__':
    try:main()
    except Exception as error:
        # Messages above are controlled; do not expose subprocess output or secret values.
        if isinstance(error,RuntimeError):print('STOP: '+str(error))
        else:print('STOP: preparation failed ('+type(error).__name__+'); no deployment performed')
        raise SystemExit(1)
