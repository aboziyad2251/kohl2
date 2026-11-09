-- Proposed only. Await explicit approval before running this migration.
begin;
alter table public.properties
  add column map_purposes text[] not null default '{}'::text[],
  add column map_visible boolean not null default true,
  add constraint properties_map_purposes_valid check (
    map_purposes <@ array['MANAGEMENT','RENT','SALE']::text[] and
    cardinality(map_purposes)<=3 and array_position(map_purposes,null) is null and
    coalesce(array_ndims(map_purposes),1)=1
  );
alter table public.managed_property_contracts
  add column latitude double precision,
  add column longitude double precision,
  add column city text not null default '',
  add column address text not null default '',
  add column map_purposes text[] not null default array['MANAGEMENT']::text[],
  add column map_visible boolean not null default true,
  add constraint managed_contract_gps_valid check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  ),
  add constraint managed_contract_map_purposes_valid check (
    map_purposes <@ array['MANAGEMENT','RENT','SALE']::text[] and
    cardinality(map_purposes)<=3 and array_position(map_purposes,null) is null and
    coalesce(array_ndims(map_purposes),1)=1
  );
comment on column public.properties.map_purposes is 'Office map classifications; empty means not classified, not an inferred listing purpose.';
comment on column public.properties.map_visible is 'Shown only on the authenticated internal Kohl property map when GPS is set; never public listing consent.';
-- Existing role/property RLS and grants remain unchanged. No public endpoints,
-- tables, buckets, external-account privileges or guessed coordinates are added.
commit;
