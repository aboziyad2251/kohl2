-- PROPOSED ONLY: production migration requires user approval.
begin;
alter table public.properties add column property_kind text check(property_kind in ('LAND','APARTMENT','VILLA','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK')),
 add column property_use text check(property_use in ('Residential','Commercial'));
-- Preserve legacy classification; only backfill facts already known.
update public.properties set property_kind='LAND' where property_type in ('Land','أرض');
update public.properties set property_use=case when property_type in ('Residential','سكني') then 'Residential' when property_type in ('Commercial','تجاري') then 'Commercial' end;
create table public.property_import_batches(
 id uuid primary key,fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 document_id uuid not null references public.ownership_documents(id),property_ids uuid[] not null,
 skipped_count integer not null default 0 check(skipped_count>=0),created_by uuid default auth.uid(),created_at timestamptz not null default now());
alter table public.property_import_batches enable row level security;
create policy office_import_read on public.property_import_batches for select to authenticated using(portal_private.is_executive() or portal_private.has_role('EMPLOYEE'));
create policy office_import_insert on public.property_import_batches for insert to authenticated with check(created_by=auth.uid() and (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')));
grant select,insert on public.property_import_batches to authenticated;
revoke all on public.property_import_batches from anon;
insert into public.property_import_batches(id,fingerprint,document_id,property_ids,created_by)
 select d.import_request_id,d.import_fingerprint,d.id,coalesce(array_agg(p.id) filter(where p.id is not null),'{}'::uuid[]),null
 from public.ownership_documents d left join public.properties p on p.ownership_document_id=d.id
 where d.import_request_id is not null group by d.id;
create or replace function public.import_property_apartments(payload jsonb, fingerprint text, object_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d uuid; row_data jsonb; ids uuid[]='{}'; p uuid; prior record; request_id uuid; owner_id uuid; skipped integer:=0; existing_count integer; kind text; use_type text;
begin
 if auth.uid() is null or not (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')) then raise exception 'Not authorized' using errcode='42501'; end if;
 request_id:=(payload->>'request_id')::uuid;owner_id:=(payload->>'lessor_id')::uuid;
 if request_id is null or fingerprint is null or length(fingerprint)<>64 or fingerprint !~ '^[a-f0-9]+$' then raise exception 'Invalid import';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into prior from public.property_import_batches where id=request_id;
 if found then
  if prior.fingerprint is distinct from fingerprint then raise exception 'Import changed';end if;
  ids:=prior.property_ids;
  return jsonb_build_object('document_id',prior.document_id,'property_ids',coalesce(ids,'{}'),'replayed',true,'skipped',prior.skipped_count);
 end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 500 then raise exception 'Invalid apartments';end if;
 if nullif(btrim(payload->>'building_name'),'') is null or nullif(btrim(payload->>'city'),'') is null or nullif(btrim(payload->>'address'),'') is null or nullif(btrim(payload->>'document_number'),'') is null or (payload->>'issue_date')::date is null then raise exception 'Missing information';end if;
 if (payload->>'latitude') is null or (payload->>'longitude') is null or not ((payload->>'latitude')::float8 between -90 and 90 and (payload->>'longitude')::float8 between -180 and 180) then raise exception 'Invalid GPS';end if;
 if object_path !~ ('^'||request_id::text||'/[a-f0-9]{64}\.(pdf|jpg|png)$') then raise exception 'Invalid deed path';end if;
 perform 1 from public.lessors where id=owner_id;if not found then raise exception 'Owner unavailable';end if;
 -- Serialize imports of the same deed to prevent accidental repeated schedules.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||translate(btrim(payload->>'document_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),0));
 select count(*), (array_agg(id order by id))[1] into existing_count,d from public.ownership_documents where lessor_id=owner_id and translate(btrim(document_number),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')=translate(btrim(payload->>'document_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
 if existing_count>1 then raise exception 'Multiple deeds match; review records' using errcode='P0002'; end if;
 kind:=coalesce(payload->>'property_kind','APARTMENT');use_type:=coalesce(payload->>'property_use','Residential');
 if kind not in ('LAND','APARTMENT','VILLA','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK') or use_type not in ('Residential','Commercial') then raise exception 'Invalid classification';end if;
 if d is null then
  d:=gen_random_uuid();
  insert into public.ownership_documents(id,document_number,issue_date,lessor_id,deed_object_path,import_request_id,import_fingerprint)
  values(d,btrim(payload->>'document_number'),(payload->>'issue_date')::date,owner_id,object_path,request_id,fingerprint);
 end if;
 for row_data in select value from jsonb_array_elements(payload->'rows') loop
  if nullif(btrim(row_data->>'apartment_number'),'') is null or length(row_data->>'apartment_number')>60 or jsonb_typeof(row_data) is distinct from 'object' then raise exception 'Invalid apartment';end if;
  if exists(select 1 from public.properties where ownership_document_id=d and translate(btrim(spreadsheet_details->>'apartment_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')=translate(btrim(row_data->>'apartment_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')) then skipped:=skipped+1;continue;end if;
  p:=gen_random_uuid();
  insert into public.properties(id,property_name,property_type,address,city,units_count,ownership_document_id,lessor_id,latitude,longitude,map_purposes,map_visible,spreadsheet_details,property_kind,property_use)
  values(p,(payload->>'building_name')||' — '||case kind when 'LAND' then 'أرض' when 'APARTMENT' then 'شقة' when 'VILLA' then 'فيلا' when 'BUILDING' then 'عمارة' when 'SHOWROOM' then 'معرض' when 'SHOP' then 'محل' when 'KIOSK' then 'كشك' else 'فود ترك' end||' '||(row_data->>'apartment_number'),use_type,payload->>'address',payload->>'city',1,d,owner_id,(payload->>'latitude')::float8,(payload->>'longitude')::float8,array(select jsonb_array_elements_text(payload->'map_purposes')),true,row_data||jsonb_build_object('source_name',payload->>'source_name','sheet_name',payload->>'sheet_name'),kind,use_type);
  ids:=array_append(ids,p);
 end loop;
 insert into public.property_import_batches(id,fingerprint,document_id,property_ids,skipped_count,created_by) values(request_id,fingerprint,d,ids,skipped,auth.uid());
 return jsonb_build_object('document_id',d,'property_ids',ids,'replayed',false,'skipped',skipped);
end $$;
revoke all on function public.import_property_apartments(jsonb,text,text) from public,anon;
grant execute on function public.import_property_apartments(jsonb,text,text) to authenticated;
commit;
