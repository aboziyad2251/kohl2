-- kr_workflow is SECURITY INVOKER and validates actors against this private table.
-- BYPASSRLS does not confer table SELECT privileges. The server-only service role
-- needs this read for signed-in GET/QUEUE/PREPARE and approval task assignment.
-- No grants are added for browser roles, and no account records are modified.
begin;
set local lock_timeout = '5s';
grant select on portal_private.accounts to service_role;
commit;
