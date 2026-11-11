-- Apply after the reviewed leasing/internal-finance candidate, never by blanket db push.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kohl-finance-documents','kohl-finance-documents',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from storage.buckets where id='kohl-finance-documents' and not public and file_size_limit=5242880) then
  raise exception 'Private document bucket configuration differs; inspect before deployment';
 end if;
end $$;
-- Even broad permissive legacy policies must not expose this bucket to browsers.
create policy kohl_finance_no_browser_access on storage.objects as restrictive
for all to anon,authenticated using(bucket_id<>'kohl-finance-documents') with check(bucket_id<>'kohl-finance-documents');
create unique index operations_documents_content on portal_private.operations_documents(entry_id,sha256);

-- Only the authenticated application server (service_role) can reserve/finalize files.
-- It supplies the identity obtained with auth.getUser; each operation rechecks active private role.
create function public.operations_document(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare acct portal_private.accounts; entry portal_private.internal_entries; doc portal_private.operations_documents;
 target uuid; entry_key uuid; ext text; result jsonb;
begin
 select * into acct from portal_private.accounts where user_id=actor and is_active for share;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE') then raise insufficient_privilege; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation='RESERVE' then
  if payload-array['id','entry_id','filename','mime','size','sha256']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  entry_key:=(payload->>'entry_id')::uuid;target:=(payload->>'id')::uuid;
 else
  if operation not in ('READ','FINISH','ABORT') or payload-array['id']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  target:=(payload->>'id')::uuid;
  select entry_id into entry_key from portal_private.operations_documents where id=target;
 end if;
 select * into entry from portal_private.internal_entries where id=entry_key for update;
 if not found or (acct.role='EMPLOYEE' and entry.created_by<>actor) then raise insufficient_privilege; end if;
 if operation='RESERVE' then
  if entry.status<>'PENDING' then raise exception 'Reviewed entry documents are immutable' using errcode='40001'; end if;
  select * into doc from portal_private.operations_documents where entry_id=entry_key and sha256=payload->>'sha256';
  if found then
   if doc.status='READY' then return to_jsonb(doc); end if;
   if doc.created_at<=now()-interval '15 minutes' then
    update portal_private.operations_documents set uploaded_by=actor,created_at=now() where id=doc.id returning * into doc;
    return to_jsonb(doc);
   end if;
   raise exception 'Upload already reserved; retry after reservation timeout' using errcode='40001';
  end if;
  if (select count(*) from portal_private.operations_documents where entry_id=entry_key)>=10 then raise exception 'Document limit reached' using errcode='54000'; end if;
  ext:=case payload->>'mime' when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if ext is null or target is null then raise invalid_parameter_value; end if;
  insert into portal_private.operations_documents(id,entry_id,uploaded_by,filename,mime,size,sha256,object_path,status)
  values(target,entry_key,actor,payload->>'filename',payload->>'mime',(payload->>'size')::integer,payload->>'sha256',entry_key::text||'/'||target::text||'.'||ext,'UPLOADING') returning * into doc;
 elsif operation='READ' then
  select * into doc from portal_private.operations_documents where id=target and status='READY';
  if not found then raise insufficient_privilege; end if;
 elsif operation='FINISH' then
  select * into doc from portal_private.operations_documents where id=target for update;
  if not found or doc.uploaded_by<>actor then raise insufficient_privilege; end if;
  if entry.status<>'PENDING' or doc.status<>'UPLOADING' or doc.created_at<=now()-interval '15 minutes' then raise exception 'Upload is no longer valid' using errcode='40001'; end if;
  if not exists(select 1 from storage.objects where bucket_id='kohl-finance-documents' and name=doc.object_path) then raise exception 'Stored object missing' using errcode='40001'; end if;
  update portal_private.operations_documents set status='READY' where id=target returning * into doc;
  insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
   values(entry.id,entry.case_id,actor,'DOCUMENT_ATTACHED',doc.filename,jsonb_build_object('document_id',doc.id,'sha256',doc.sha256));
 elsif operation='ABORT' then
  select * into doc from portal_private.operations_documents where id=target for update;
  if not found or doc.uploaded_by<>actor or doc.status<>'UPLOADING' then raise insufficient_privilege; end if;
  delete from portal_private.operations_documents where id=target;
 end if;
 return to_jsonb(doc);
end $$;
revoke all on function public.operations_document(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.operations_document(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
