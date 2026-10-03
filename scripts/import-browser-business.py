"""VPS operator: validate and import the four confirmed business collections.

Defaults to a rolled-back rehearsal. --apply commits only after all comparisons
and FK checks succeed. Never replays browser deletes or overwrites server rows.
"""
import argparse, hashlib, json, pathlib, re, subprocess, uuid

parser=argparse.ArgumentParser()
parser.add_argument('backup')
parser.add_argument('--database',required=True)
parser.add_argument('--apply',action='store_true')
args=parser.parse_args()
if args.database!='postgres' and not re.fullmatch(r'kohl_cutover_[a-z0-9]+',args.database):
    raise ValueError('Unrecognized target database')
raw=pathlib.Path(args.backup).read_bytes()
backup=json.loads(raw)
assert backup['origin']=='https://app.kohlestate-ksa.online'
collections={
 'lessors':('kohl_lessors_v1','id name national_id_or_cr phone email'),
 'ownership_documents':('kohl_ownership_documents_v1','id document_number issue_date file_url lessor_id'),
 'properties':('kohl_properties_v1','id property_name property_type address city units_count ownership_document_id lessor_id current_representative_id'),
 'brokerage_agreements':('kohl_brokerage_agreements_v1','id agreement_number property_id lessor_id commission_rate office_profit start_date expiry_date ejar_status file_url'),
}
quote=lambda value:"'"+value.replace("'","''")+"'"
sql=['begin;', 'set local lock_timeout=\'5s\';', 'set local statement_timeout=\'60s\';']
counts={}
deleted=set(json.loads(backup['data']['kohl_deleted_ids_v1']))
for table,(key,columns) in collections.items():
    rows=json.loads(backup['data'][key]);counts[table]=len(rows)
    assert len({r['id'] for r in rows})==len(rows),'Duplicate IDs'
    sql.append('lock table public.'+table+' in share row exclusive mode;')
    for row in rows:
        uuid.UUID(row['id']);assert row['id'] not in deleted,'Record marked deleted'
        row=dict(row)
        if table=='properties':row['property_name']=row.pop('title')
        clean={k:row[k] for k in columns.split() if k in row}
        for k in clean:
            if k.endswith('_id') and clean[k]=='':clean[k]=None
        # Existing rows must match every supplied business field exactly.
        payload=quote(json.dumps(clean,ensure_ascii=False))+'::jsonb'
        sql.append("do $$ begin if exists(select 1 from public."+table+" t where id="+quote(row['id'])+"::uuid and not (to_jsonb(t) @> "+payload+")) then raise exception 'Existing business record differs; manual reconciliation required'; end if; end $$;")
        fields=','.join(clean)
        sql.append('insert into public.'+table+' ('+fields+') select '+fields+' from jsonb_populate_record(null::public.'+table+','+payload+') on conflict(id) do nothing;')
sql.append('commit;' if args.apply else 'rollback;')
result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',args.database,'-v','ON_ERROR_STOP=1'],input='\n'.join(sql),text=True,capture_output=True)
if result.returncode:
    log=pathlib.Path(args.backup).parent/'import-failure.private.log'
    log.write_text(result.stderr);log.chmod(0o600)
    raise SystemExit('Import rolled back; inspect private import-failure.private.log')
print(json.dumps({'committed':args.apply,'database':args.database,'validated_records':counts,'backup_sha256':hashlib.sha256(raw).hexdigest()}))
