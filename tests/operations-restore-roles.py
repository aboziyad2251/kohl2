"""Exercise role SQL generation and replay on disposable PostgreSQL 17."""
import importlib.util
from pathlib import Path
import subprocess
import time
import uuid

spec = importlib.util.spec_from_file_location('review', Path(__file__).resolve().parents[1] / 'scripts/rehearse-operations-restore.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
name = 'kohl_roles_test_' + uuid.uuid4().hex[:12]
image = 'postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac'
def sql(statement):
    return subprocess.check_output(['docker','exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],input=statement,text=True).strip()
created=False
try:
    subprocess.run(['docker','run','-d','--pull','never','--name',name,'--network','none',
        '--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,size=256m',
        '-e','POSTGRES_HOST_AUTH_METHOD=trust',image],check=True,stdout=subprocess.DEVNULL)
    created=True
    for _ in range(60):
        if subprocess.check_output(['docker','exec',name,'cat','/proc/1/comm'],text=True).strip() == 'postgres' and subprocess.run(['docker','exec',name,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        time.sleep(.25)
    sql('CREATE ROLE "fixture group"; CREATE ROLE fixture_user NOINHERIT; GRANT "fixture group" TO fixture_user WITH ADMIN TRUE, INHERIT FALSE, SET TRUE;')
    exported=sql(mod.ROLE_SQL)
    assert 'WITH ADMIN TRUE, INHERIT FALSE, SET TRUE' in exported
    assert 'WITH ADMIN FALSE' in exported  # built-in pg_monitor memberships
    sql('DROP ROLE fixture_user; DROP ROLE "fixture group";')
    sql(exported)
    assert sql("""SELECT a.admin_option AND NOT a.inherit_option AND a.set_option
        FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid
        JOIN pg_roles m ON m.oid=a.member
        WHERE r.rolname='fixture group' AND m.rolname='fixture_user'""") == 't'
    assert sql("SELECT NOT rolcanlogin AND NOT rolinherit FROM pg_roles WHERE rolname='fixture_user'") == 't'
    spec2=importlib.util.spec_from_file_location('services',mod.ROOT/'scripts/test-operations-services.py')
    services=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(services)
    sql("CREATE ROLE supabase_auth_admin; CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;")
    sql("""SET ROLE supabase_auth_admin;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.role',true),'')$$;
        RESET ROLE;""")
    sql(services.AUTH_HELPERS)
    assert sql("SELECT bool_and(pg_get_userbyid(proowner)='supabase_auth_admin') FROM pg_proc WHERE pronamespace='auth'::regnamespace")=='t'
    assert sql("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='supabase_auth_admin'")=='f'
    assert sql("""SET request.jwt.claims='{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
        SELECT auth.uid()::text || ':' || auth.role();""")=='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:authenticated'
    print('PASS: Auth helper replacement preserves owner without elevated privileges and reads JWT claims')
    print('PASS: PostgreSQL 17 role export/replay preserves TRUE/FALSE options and quoted role names')
finally:
    if created:
        subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
