const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),path=require('path');
const ids={admin:'11111111-1111-4111-8111-111111111111',ceo:'22222222-2222-4222-8222-222222222222',employee:'33333333-3333-4333-8333-333333333333',manager:'44444444-4444-4444-8444-444444444444',owner:'55555555-5555-4555-8555-555555555555'};
async function fixture(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema portal_private;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create table auth.audit_log_entries(id uuid primary key default gen_random_uuid(),payload jsonb,ip_address text,created_at timestamptz default now());
create table portal_private.accounts(user_id uuid primary key references auth.users,full_name text,role text,is_active boolean not null default true);
create function portal_private.is_executive() returns boolean language sql stable security definer as $$select exists(select 1 from portal_private.accounts where user_id=auth.uid() and is_active and role in ('ADMIN','CEO'))$$;
create function portal_private.has_role(r text) returns boolean language sql stable security definer as $$select exists(select 1 from portal_private.accounts where user_id=auth.uid() and is_active and role=r)$$;
create table portal_private.bill_counters(kind text,year integer,last_value bigint,primary key(kind,year));
create table portal_private.bill_forms(id uuid primary key,actor uuid,number text unique,snapshot jsonb,created_at timestamptz default now());
create function public.issue_standard_form(request_id uuid,payload jsonb) returns jsonb language sql as $$select payload$$;
create table public.lessors(id uuid primary key default gen_random_uuid(),name text not null);
create table public.representatives(id uuid primary key default gen_random_uuid(),name text not null);
create table public.ownership_documents(id uuid primary key default gen_random_uuid(),document_number text not null unique,lessor_id uuid references public.lessors(id));
create table public.properties(id uuid primary key default gen_random_uuid(),property_name text not null,property_type text not null,property_kind text,property_use text,address text not null,city text not null,units_count integer not null default 1,lessor_id uuid not null references public.lessors(id),ownership_document_id uuid references public.ownership_documents(id),current_representative_id uuid references public.representatives(id),region text,district text,latitude double precision,longitude double precision,rooms integer,lounges integer,bathrooms integer,entrances integer,price numeric,rooms_edited boolean not null default false,lounges_edited boolean not null default false,bathrooms_edited boolean not null default false,entrances_edited boolean not null default false,price_edited boolean not null default false,map_purposes text[] not null default '{}',map_visible boolean not null default true,media_url text,spreadsheet_details jsonb,created_at timestamptz default now());
grant usage on schema public,auth,portal_private to authenticated,service_role;
grant select on portal_private.accounts to service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
`);
for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1,$2)',[id,role+'@fixture.invalid']);await db.query('insert into portal_private.accounts values($1,$2,$3,true)',[id,role==='manager'?'Future Operations Manager':'Fixture '+role,role==='owner'?'OWNER':role==='ceo'?'CEO':role==='admin'?'ADMIN':'EMPLOYEE']);}
return db;}
async function migrate(db,name){await db.exec(fs.readFileSync(path.join(__dirname,'../../supabase/migrations',name),'utf8'));}
async function actor(db,key,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[key]||'',JSON.stringify({role,sub:ids[key]||undefined})]);await db.exec('set role '+role);}
module.exports={fixture,migrate,actor,ids};
