-- Additive canonical inventory fields. Existing deed/media/ownership workflows stay intact.
begin;
set local lock_timeout='5s';
alter table public.properties add column property_code text,add column license_number text,
 add column building_name text,add column unit_number text,add column notes text,
 add column amenities jsonb not null default '{}',add column unit_number_edited boolean not null default false,add column building_name_edited boolean not null default false;
create unique index properties_code_unique on public.properties(translate(lower(btrim(property_code)),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')) where property_code is not null and btrim(property_code)<>'';
create unique index property_current_deed_unit_unique on public.properties(ownership_document_id,(translate(lower(btrim((case when unit_number_edited then unit_number else coalesce(unit_number,spreadsheet_details->>'apartment_number') end))),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'))) where ownership_document_id is not null and (case when unit_number_edited then unit_number else coalesce(unit_number,spreadsheet_details->>'apartment_number') end) is not null;
create function portal_private.valid_property_amenities(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare e record; n numeric; begin
 if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>5000 then return false;end if;
 for e in select * from jsonb_each(value) loop
  if e.key not in ('master_rooms','maid_rooms','balconies','parking_spaces','area_sqm','property_age','floor_number','elevator','ac','furnished','kitchen','pool','garden','security','disability_access','orientation') then return false;end if;
  if e.value='null'::jsonb then continue;end if;
  if e.key in ('elevator','ac','furnished','kitchen','pool','garden','security','disability_access') then if jsonb_typeof(e.value)<>'boolean' then return false;end if;
  elsif e.key='orientation' then if jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>100 then return false;end if;
  else
   if jsonb_typeof(e.value)<>'number' then return false;end if;n:=(e.value#>>'{}')::numeric;
   if e.key='floor_number' then if n<>trunc(n) or n not between -10 and 300 then return false;end if;
   elsif e.key='area_sqm' then if n not between 0 and 100000000 then return false;end if;
   elsif e.key='property_age' then if n<>trunc(n) or n not between 0 and 500 then return false;end if;
   elsif n<>trunc(n) or n not between 0 and 1000 then return false;end if;
  end if;
 end loop;return true;
end $$;
revoke all on function portal_private.valid_property_amenities(jsonb) from public,anon;
grant execute on function portal_private.valid_property_amenities(jsonb) to authenticated,service_role;
alter table public.properties add constraint property_amenities_valid check(portal_private.valid_property_amenities(amenities)),add constraint property_code_length check(property_code is null or length(property_code) between 1 and 100),add constraint property_license_length check(license_number is null or length(license_number)<=100),add constraint property_building_length check(building_name is null or length(building_name)<=180),add constraint property_unit_length check(unit_number is null or length(unit_number)<=60),add constraint property_notes_length check(notes is null or length(notes)<=2000);

create table portal_private.property_import_previews(id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),catalog_version text not null,plan jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour',committed_hash text,result jsonb);
alter table portal_private.property_import_previews enable row level security;
revoke all on portal_private.property_import_previews from public,anon,authenticated;
grant select,insert,update on portal_private.property_import_previews to service_role;

create function portal_private.property_import_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'catalog',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.properties p),'[]'),
 'owners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name) order by l.id) from public.lessors l),'[]'),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'document_number',d.document_number,'lessor_id',d.lessor_id) order by d.id) from public.ownership_documents d),'[]'),
 'representatives',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.id) from public.representatives r),'[]'));
$$;
revoke all on function portal_private.property_import_snapshot() from public,anon,authenticated;
grant execute on function portal_private.property_import_snapshot() to service_role;
create function public.property_import_context(actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; begin
 if not exists(select 1 from portal_private.accounts a where a.user_id=actor and a.is_active and a.role in ('ADMIN','CEO','EMPLOYEE')) then raise exception 'Operational staff only' using errcode='42501';end if;
 if (select count(*) from public.properties)>10000 then raise exception 'Catalog exceeds bounded import limit';end if;
 snapshot:=portal_private.property_import_snapshot();return snapshot||jsonb_build_object('version',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'));
end $$;
revoke all on function public.property_import_context(uuid) from public,anon,authenticated;
grant execute on function public.property_import_context(uuid) to service_role;
create function public.store_property_import_preview(actor uuid,plan jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_snapshot jsonb; result uuid; begin
 current_snapshot:=public.property_import_context(actor);
 if plan->>'version' is distinct from current_snapshot->>'version' then raise exception 'Catalog changed; preview again' using errcode='40001';end if;
 if jsonb_typeof(plan->'rows') is distinct from 'array' or jsonb_array_length(plan->'rows') not between 1 and 500 or octet_length(plan::text)>8388608 then raise exception 'Invalid preview size';end if;
 insert into portal_private.property_import_previews(actor,catalog_version,plan) values(actor,plan->>'version',plan) returning id into result;
 return jsonb_build_object('request_id',result,'expires_in_seconds',3600);
end $$;
revoke all on function public.store_property_import_preview(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.store_property_import_preview(uuid,jsonb) to service_role;

create function public.commit_property_import(actor uuid,request_id uuid,decisions jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved portal_private.property_import_previews; snapshot jsonb; row_data jsonb; decision jsonb; patch jsonb; target uuid; prior public.properties; incoming public.properties; seen uuid[]:='{}'; ids uuid[]:='{}'; creates integer:=0; updates integer:=0; skips integer:=0; fingerprint text; commit_result jsonb; field text; begin
 if not exists(select 1 from portal_private.accounts a where a.user_id=actor and a.is_active and a.role in ('ADMIN','CEO','EMPLOYEE')) then raise exception 'Operational staff only' using errcode='42501';end if;
 select * into saved from portal_private.property_import_previews p where p.id=request_id for update;
 if not found or saved.actor<>actor then raise exception 'Preview unavailable' using errcode='42501';end if;
 fingerprint:=encode(sha256(convert_to(decisions::text,'UTF8')),'hex');
 if saved.result is not null then if saved.committed_hash<>fingerprint then raise exception 'Committed decisions changed' using errcode='40001';end if;return saved.result||jsonb_build_object('replayed',true);end if;
 if saved.expires_at<now() then raise exception 'Preview expired; preview again' using errcode='40001';end if;
 if jsonb_typeof(decisions) is distinct from 'array' or jsonb_array_length(decisions)<>jsonb_array_length(saved.plan->'rows') or exists(select 1 from jsonb_array_elements(decisions) d group by d->>'source_row' having count(*)>1) then raise exception 'Resolve every row once';end if;
 -- Serialize against manual property writes and other import commits, then recheck the
 -- full catalog/owner/deed context. No decisions are made from stale preview data.
 lock table public.properties in share row exclusive mode;
 lock table public.lessors,public.ownership_documents,public.representatives in share mode;
 snapshot:=portal_private.property_import_snapshot();
 if encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')<>saved.catalog_version then raise exception 'Catalog changed; preview again' using errcode='40001';end if;
 for row_data in select value from jsonb_array_elements(saved.plan->'rows') loop
  select d into decision from jsonb_array_elements(decisions) d where d->>'source_row'=row_data->>'source_row';
  if decision is null or decision->>'action' not in ('NEW','UPDATE','SKIP') then raise exception 'Unresolved row';end if;
  if decision->>'action'='SKIP' then skips:=skips+1;continue;end if;
  if jsonb_array_length(row_data->'errors')>0 then raise exception 'Invalid row';end if;
  patch:=row_data->'patch';
  if jsonb_typeof(patch) is distinct from 'object' then raise exception 'Invalid patch';end if;
  for field in select jsonb_object_keys(patch) loop
   if field not in ('property_code','license_number','property_name','property_type','property_kind','property_use','building_name','unit_number','lessor_id','ownership_document_id','current_representative_id','region','city','district','address','latitude','longitude','units_count','rooms','lounges','bathrooms','entrances','price','media_url','map_visible','map_purposes','notes','amenities') then raise exception 'Unknown property field';end if;
  end loop;
  incoming:=jsonb_populate_record(null::public.properties,patch);
  if patch ? 'amenities' and not portal_private.valid_property_amenities(incoming.amenities) then raise exception 'Invalid amenities';end if;
  if incoming.media_url is not null and incoming.media_url !~ '^https://' then raise exception 'HTTPS required';end if;
  if incoming.latitude is not null and incoming.latitude not between -90 and 90 or incoming.longitude is not null and incoming.longitude not between -180 and 180 then raise exception 'Invalid coordinates';end if;
  if incoming.ownership_document_id is not null and not exists(select 1 from public.ownership_documents d where d.id=incoming.ownership_document_id and (incoming.lessor_id is null or d.lessor_id=incoming.lessor_id)) then raise exception 'Deed/owner mismatch';end if;
  if decision->>'action'='NEW' then
   if jsonb_array_length(row_data->'new_errors')>0 or nullif(btrim(incoming.property_name),'') is null or nullif(btrim(incoming.city),'') is null or nullif(btrim(incoming.address),'') is null or incoming.lessor_id is null or incoming.property_type not in ('Residential','Commercial','Land') then raise exception 'Missing required new property fields';end if;
   target:=gen_random_uuid();
   insert into public.properties(id,property_name,property_type,address,city,lessor_id,units_count,property_code,license_number,property_kind,property_use,building_name,unit_number,ownership_document_id,current_representative_id,region,district,latitude,longitude,rooms,lounges,bathrooms,entrances,price,media_url,map_visible,map_purposes,notes,amenities,rooms_edited,lounges_edited,bathrooms_edited,entrances_edited,price_edited,unit_number_edited,building_name_edited)
   values(target,incoming.property_name,incoming.property_type,incoming.address,incoming.city,incoming.lessor_id,coalesce(incoming.units_count,1),incoming.property_code,incoming.license_number,incoming.property_kind,incoming.property_use,incoming.building_name,incoming.unit_number,incoming.ownership_document_id,incoming.current_representative_id,incoming.region,incoming.district,incoming.latitude,incoming.longitude,incoming.rooms,incoming.lounges,incoming.bathrooms,incoming.entrances,incoming.price,incoming.media_url,coalesce(incoming.map_visible,true),coalesce(incoming.map_purposes,'{}'),incoming.notes,coalesce(incoming.amenities,'{}'),patch ? 'rooms',patch ? 'lounges',patch ? 'bathrooms',patch ? 'entrances',patch ? 'price',patch ? 'unit_number',patch ? 'building_name');
   creates:=creates+1;
  else
   target:=(decision->>'target_id')::uuid;
   if target is null or not (row_data->'candidate_ids') ? target::text then raise exception 'Choose a proposed existing property';end if;
   if target=any(seen) then raise exception 'Several rows target the same property; resolve duplicates';end if;
   select * into prior from public.properties p where p.id=target for update;
   if not found then raise exception 'Property disappeared' using errcode='40001';end if;
   foreach field in array array['lessor_id','ownership_document_id','current_representative_id'] loop
    if patch ? field and patch->field is distinct from to_jsonb(prior)->field then raise exception 'Use the existing audited ownership transfer workflow';end if;
   end loop;
   updates:=updates+1;
  end if;
  seen:=array_append(seen,target);ids:=array_append(ids,target);
  -- Column-specific updates are generated below from the shared allowlist. Ownership
  -- columns are guarded above for updates and populated normally for new records.
  if decision->>'action'='UPDATE' then
  update public.properties p set
   property_code=case when patch ? 'property_code' then incoming.property_code else p.property_code end,
   license_number=case when patch ? 'license_number' then incoming.license_number else p.license_number end,
   property_name=case when patch ? 'property_name' then incoming.property_name else p.property_name end,
   property_type=case when patch ? 'property_type' then incoming.property_type else p.property_type end,
   property_kind=case when patch ? 'property_kind' then incoming.property_kind else p.property_kind end,
   property_use=case when patch ? 'property_use' then incoming.property_use else p.property_use end,
   building_name=case when patch ? 'building_name' then incoming.building_name else p.building_name end,
   unit_number=case when patch ? 'unit_number' then incoming.unit_number else p.unit_number end,
   lessor_id=case when patch ? 'lessor_id' then incoming.lessor_id else p.lessor_id end,
   ownership_document_id=case when patch ? 'ownership_document_id' then incoming.ownership_document_id else p.ownership_document_id end,
   current_representative_id=case when patch ? 'current_representative_id' then incoming.current_representative_id else p.current_representative_id end,
   region=case when patch ? 'region' then incoming.region else p.region end,
   city=case when patch ? 'city' then incoming.city else p.city end,
   district=case when patch ? 'district' then incoming.district else p.district end,
   address=case when patch ? 'address' then incoming.address else p.address end,
   latitude=case when patch ? 'latitude' then incoming.latitude else p.latitude end,
   longitude=case when patch ? 'longitude' then incoming.longitude else p.longitude end,
   units_count=case when patch ? 'units_count' then incoming.units_count else p.units_count end,
   rooms=case when patch ? 'rooms' then incoming.rooms else p.rooms end,
   lounges=case when patch ? 'lounges' then incoming.lounges else p.lounges end,
   bathrooms=case when patch ? 'bathrooms' then incoming.bathrooms else p.bathrooms end,
   entrances=case when patch ? 'entrances' then incoming.entrances else p.entrances end,
   price=case when patch ? 'price' then incoming.price else p.price end,
   media_url=case when patch ? 'media_url' then incoming.media_url else p.media_url end,
   map_visible=case when patch ? 'map_visible' then incoming.map_visible else p.map_visible end,
   map_purposes=case when patch ? 'map_purposes' then incoming.map_purposes else p.map_purposes end,
   notes=case when patch ? 'notes' then incoming.notes else p.notes end,
   amenities=coalesce(p.amenities,'{}')||coalesce(patch->'amenities','{}'),
   rooms_edited=case when patch ? 'rooms' then true else p.rooms_edited end,
   lounges_edited=case when patch ? 'lounges' then true else p.lounges_edited end,
   bathrooms_edited=case when patch ? 'bathrooms' then true else p.bathrooms_edited end,
   entrances_edited=case when patch ? 'entrances' then true else p.entrances_edited end,
   price_edited=case when patch ? 'price' then true else p.price_edited end,
   unit_number_edited=case when patch ? 'unit_number' then true else p.unit_number_edited end,
   building_name_edited=case when patch ? 'building_name' then true else p.building_name_edited end where p.id=target;
  end if;
 end loop;
 commit_result:=jsonb_build_object('created',creates,'updated',updates,'skipped',skips,'property_ids',ids,'replayed',false);
 update portal_private.property_import_previews p set committed_hash=fingerprint,result=commit_result where p.id=request_id;
 perform public.record_audit_event(actor,'FORM_SUBMIT','Properties',request_id::text,jsonb_build_object('source','property_bulk_import','outcome','SUCCESS','created',creates,'updated',updates,'skipped',skips));
 return commit_result;
end $$;
revoke all on function public.commit_property_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_property_import(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
