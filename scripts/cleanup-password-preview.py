"""Remove only fake fixtures left by verify-password-release from the isolated DB."""
import json, subprocess
from urllib.parse import urlparse
rest=json.loads(subprocess.check_output(['docker','inspect','kohl-cutover-preview-rest']))[0]
env=dict(x.split('=',1) for x in rest['Config']['Env'] if '=' in x)
database=urlparse(env['PGRST_DB_URI']).path.lstrip('/')
assert database.startswith('kohl_cutover_') and database!='postgres'
query="""begin;
create temporary table password_test_ids as
select a.user_id from portal_private.accounts a join auth.users u on u.id=a.user_id
where a.full_name in ('Isolated password admin','Isolated password OWNER','Isolated password TENANT','Isolated password BROKER')
and u.email like '%@test.invalid';
delete from portal_private.owner_property_links where owner_user_id in (select user_id from password_test_ids);
delete from portal_private.tenant_lease_links where tenant_user_id in (select user_id from password_test_ids);
delete from portal_private.broker_contract_links where broker_user_id in (select user_id from password_test_ids);
delete from portal_private.broker_office_agreements where broker_user_id in (select user_id from password_test_ids);
delete from portal_private.access_audit where actor_user_id in (select user_id from password_test_ids) or target_user_id in (select user_id from password_test_ids);
delete from portal_private.accounts where user_id in (select user_id from password_test_ids);
delete from auth.users where id in (select user_id from password_test_ids);
commit;"""
subprocess.run(['docker','exec','supabase-db','psql','-X','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-c',query],check=True,stdout=subprocess.DEVNULL)
print('Isolated password test fixtures cleaned; production untouched')
