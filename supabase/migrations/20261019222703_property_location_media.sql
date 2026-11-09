-- PROPOSED ONLY: do not apply until the user explicitly approves the migration.
begin;
alter table public.properties add column latitude double precision;
alter table public.properties add column longitude double precision;
alter table public.properties add constraint property_gps_valid check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
);
comment on column public.properties.latitude is 'Confirmed property GPS pin; null means not yet set. Never geocode automatically.';

create table public.property_media (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete restrict,
  object_path text not null unique,
  filename text not null check (length(filename) between 1 and 150),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 41943040),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (mime_type not like 'image/%' or byte_size <= 10485760),
  check (split_part(object_path,'/',1) = property_id::text)
);
create index property_media_property_created on public.property_media(property_id,created_at desc);
create index property_media_uploaded_by on public.property_media(uploaded_by);
alter table public.property_media enable row level security;
-- Deny direct browser metadata mutations and direct storage reads/writes.
-- Server routes verify the active identity, role and existing properties RLS
-- before using the service role for media operations. No SECURITY DEFINER RPC.
revoke all on public.property_media from public,anon,authenticated;
grant all on public.property_media to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('property-media','property-media',false,41943040,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
-- No storage.objects policies are added: access is server-only.
-- Existing properties RLS continues to govern location reads and changes.
commit;
