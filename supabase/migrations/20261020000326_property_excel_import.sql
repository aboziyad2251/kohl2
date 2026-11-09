-- Proposed. Do not apply to production without explicit approval for this migration.
begin;
alter table public.properties add column spreadsheet_details jsonb,
 add constraint property_spreadsheet_details_object check (spreadsheet_details is null or (jsonb_typeof(spreadsheet_details)='object' and octet_length(spreadsheet_details::text)<=10000));
alter table public.ownership_documents add column deed_object_path text, add column import_request_id uuid, add column import_fingerprint text;
create unique index ownership_import_request_unique on public.ownership_documents(import_request_id) where import_request_id is not null;
create unique index property_deed_apartment_unique on public.properties(ownership_document_id,(spreadsheet_details->>'apartment_number')) where spreadsheet_details is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ownership-deeds','ownership-deeds',false,10485760,array['application/pdf','image/jpeg','image/png']);
-- No storage object policies: files can only be uploaded/signed by the checked server API.
create function public.import_property_apartments(payload jsonb, fingerprint text, object_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d uuid; row_data jsonb; ids uuid[]='{}'; p uuid; prior record; request_id uuid; owner_id uuid;
begin
 if auth.uid() is null or not (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')) then raise exception 'Not authorized' using errcode='42501'; end if;
 request_id:=(payload->>'request_id')::uuid;owner_id:=(payload->>'lessor_id')::uuid;
 if request_id is null or fingerprint is null or length(fingerprint)<>64 or fingerprint !~ '^[a-f0-9]+$' then raise exception 'Invalid import';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into prior from public.ownership_documents where import_request_id=request_id;
 if found then
  if prior.import_fingerprint is distinct from fingerprint then raise exception 'Import changed';end if;
  select array_agg(id order by id) into ids from public.properties where ownership_document_id=prior.id;
  return jsonb_build_object('document_id',prior.id,'property_ids',coalesce(ids,'{}'),'replayed',true);
 end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 500 then raise exception 'Invalid apartments';end if;
 if nullif(btrim(payload->>'building_name'),'') is null or nullif(btrim(payload->>'city'),'') is null or nullif(btrim(payload->>'address'),'') is null or nullif(btrim(payload->>'document_number'),'') is null or (payload->>'issue_date')::date is null then raise exception 'Missing information';end if;
 if (payload->>'latitude') is null or (payload->>'longitude') is null or not ((payload->>'latitude')::float8 between -90 and 90 and (payload->>'longitude')::float8 between -180 and 180) then raise exception 'Invalid GPS';end if;
 if object_path !~ ('^'||request_id::text||'/[a-f0-9]{64}\.(pdf|jpg|png)$') then raise exception 'Invalid deed path';end if;
 perform 1 from public.lessors where id=owner_id;if not found then raise exception 'Owner unavailable';end if;
 -- Serialize imports of the same deed to prevent accidental repeated schedules.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||(payload->>'document_number'),0));
 select id into d from public.ownership_documents where lessor_id=owner_id and document_number=payload->>'document_number' limit 1;
 if d is not null then raise exception 'Deed already registered; use its existing properties or a different deed number' using errcode='23505';end if;
 d:=gen_random_uuid();
 insert into public.ownership_documents(id,document_number,issue_date,lessor_id,deed_object_path,import_request_id,import_fingerprint)
 values(d,payload->>'document_number',(payload->>'issue_date')::date,owner_id,object_path,request_id,fingerprint);
 for row_data in select value from jsonb_array_elements(payload->'rows') loop
  if nullif(btrim(row_data->>'apartment_number'),'') is null or length(row_data->>'apartment_number')>60 or jsonb_typeof(row_data) is distinct from 'object' then raise exception 'Invalid apartment';end if;
  p:=gen_random_uuid();
  insert into public.properties(id,property_name,property_type,address,city,units_count,ownership_document_id,lessor_id,latitude,longitude,map_purposes,map_visible,spreadsheet_details)
  values(p,(payload->>'building_name')||' — شقة '||(row_data->>'apartment_number'),'Residential',payload->>'address',payload->>'city',1,d,owner_id,(payload->>'latitude')::float8,(payload->>'longitude')::float8,array(select jsonb_array_elements_text(payload->'map_purposes')),true,row_data||jsonb_build_object('source_name',payload->>'source_name','sheet_name',payload->>'sheet_name'));
  ids:=array_append(ids,p);
 end loop;
 return jsonb_build_object('document_id',d,'property_ids',ids,'replayed',false);
end $$;
revoke all on function public.import_property_apartments(jsonb,text,text) from public,anon;
grant execute on function public.import_property_apartments(jsonb,text,text) to authenticated;
commit;
