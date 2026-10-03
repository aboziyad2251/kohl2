-- Read-only deployment catalog. Never select credentials or user metadata.
select version();
select table_name, column_name, data_type from information_schema.columns
where table_schema = 'public' order by table_name, ordinal_position;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage');
select rolname, rolbypassrls, rolsuper from pg_roles
where rolname in ('anon','authenticated','web_anon','service_role','authenticator');
select c.relname, c.relkind, c.relrowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','web_anon');
select count(*) as auth_users_count from auth.users;
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public';
select pubname, schemaname, tablename from pg_publication_tables;
