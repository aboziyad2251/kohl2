"""Approved disposable PostgreSQL concurrency checks; never connects to a live DB."""
import concurrent.futures, json, pathlib, subprocess, time
from postgres_test_runtime import wait_for_postgres
name = 'kohl_operations_isolated_20261110'
root = pathlib.Path(__file__).parent
def process(sql, app='payout-test'):
    p = subprocess.Popen(['docker','exec','-i','-e','PGAPPNAME='+app,name,'psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    out, err = p.communicate(sql, timeout=25)
    return p.returncode, out, err
def sql(text):
    rc,out,err=process(text)
    assert rc==0, 'Isolated SQL failed: '+err[:350]
    return out.strip()
admin='11111111-1111-4111-8111-111111111111'; ceo='22222222-2222-4222-8222-222222222222'
broker='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
c1='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; c2='cccccccc-cccc-4ccc-8ccc-cccccccccccd'
agreement='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
r1='10000000-0000-4000-8000-000000000001';r2='10000000-0000-4000-8000-000000000002';r3='10000000-0000-4000-8000-000000000003'
def command(actor,op,payload):
    data=json.dumps(payload).replace("'","''")
    return f"begin; set local role authenticated; set local statement_timeout='12s'; select set_config('request.jwt.claim.sub','{actor}',true); select public.kohl_operations('{op}','{data}'::jsonb); commit;"
def rpc(actor,op,payload):return process(command(actor,op,payload))
def race(lock_sql,commands):
    holder=subprocess.Popen(['docker','exec','-i',name,'psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    holder.stdin.write(f"begin; {lock_sql}; select 'LOCKED';\n");holder.stdin.flush()
    while holder.stdout.readline().strip()!='LOCKED':
        assert holder.poll() is None,'Lock holder failed'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs=[pool.submit(process,text,'payout-race-'+str(i)) for i,text in enumerate(commands)]
        try:
            waiting=0
            for _ in range(60):
                waiting=int(sql("select count(*) from pg_stat_activity where application_name in ('payout-race-0','payout-race-1') and wait_event_type='Lock'"))
                if waiting==2:break
                time.sleep(.1)
            assert waiting==2,'Did not establish two concurrent waiting database sessions'
        finally:
            holder.stdin.write('commit;\n');holder.stdin.flush();holder.communicate(timeout=10)
        return [j.result(timeout=25) for j in jobs]

assert subprocess.run(['docker','container','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'Existing test container must be inspected'
created=False
try:
 subprocess.run(['docker','run','-d','--pull','never','--name',name,'--network','none','--memory','512m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac'],check=True,stdout=subprocess.DEVNULL)
 created=True
 wait_for_postgres(name)
 sql("""create role anon;create role authenticated;create role service_role;create schema auth;create schema portal_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean,employee_id uuid);
 create table public.properties(id uuid primary key,property_name text);
 create table public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
 create table public.contracts(id uuid primary key,contract_number text);
 grant usage on schema public,auth to authenticated;
 """)
 sql(f"insert into portal_private.accounts values('{admin}','Admin','ADMIN',true,null),('{ceo}','CEO','CEO',true,null); insert into public.properties values('{agreement}','Fixture property');insert into public.crm_leads values('{broker}','Fixture lead','0500000000','HATIF',null);")
 sql((root.parent/'supabase/migrations/20261110143135_leasing_internal_finance.sql').read_text())
 def ok(op,payload):
  rc,out,err=rpc(admin,op,payload)
  assert rc==0,err
 ok('UNIT_SAVE',dict(id=other,property_id=agreement,code='101',readiness='READY',note='Ready'))
 for cid in (c1,c2):ok('CASE_CREATE',dict(id=cid,lead_id=broker,kind='DAILY',source='Fixture',need='Two nights',next_action='Call',due_at='2026-11-10T10:00:00Z'))
 def confirm(cid):return dict(id=cid,version=1,stage='CONFIRMED',unit_id=other,start_date='2026-11-11',end_date='2026-11-13',amount=1000,beneficiary='OWNER',contract_id=None,note='Approved')
 results=race(f"select id from portal_private.leasing_units where id='{other}' for update",[command(admin,'CASE_UPDATE',confirm(c1)),command(ceo,'CASE_UPDATE',confirm(c2))])
 assert sorted(r[0]==0 for r in results)==[False,True],results
 winner=sql("select id from portal_private.leasing_cases where stage='CONFIRMED'")
 ok('INSTALLMENTS_SAVE',dict(id=r3,case_id=winner,version=2,note='Split plan',parts=[dict(amount=600,due_date='2026-11-11'),dict(amount=400,due_date='2026-12-11')]))
 first_installment=sql(f"select id from portal_private.internal_installments where case_id='{winner}' and sequence=1")
 for rid,reference in ((r1,'BANK1'),(r2,'BANK2')):ok('ENTRY_CREATE',dict(id=rid,case_id=winner,installment_id=first_installment,kind='RECEIPT',amount=400,date='2026-11-10',holder='COMPANY',reference=reference,category='Rent',note=''))
 results=race(f"select id from portal_private.leasing_cases where id='{winner}' for update",[command(admin,'ENTRY_DECIDE',dict(id=r1,status='APPROVED',note='Matched')),command(ceo,'ENTRY_DECIDE',dict(id=r2,status='APPROVED',note='Matched'))])
 assert sorted(r[0]==0 for r in results)==[False,True],results
 assert sql("select sum(amount) from portal_private.internal_entries where status='APPROVED'")=='400.00'
 assert sql("select count(*) from portal_private.internal_dues")=='1'
 print('PostgreSQL 17 concurrency passed: overlapping bookings and competing partial installment collections serialize correctly')
 # Exercise the new chain on the same disposable database after legacy regression.
 sql("""create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;""")
 sql((root.parent/'supabase/migrations/20261110215449_operations_private_documents.sql').read_text())
 sql(f"select set_config('kohl.workflow_manager','{admin}',false),set_config('kohl.workflow_final','{ceo}',false);\n"+(root.parent/'supabase/migrations/20261112172325_operations_approval_chain.sql').read_text())
 second=sql(f"select id from portal_private.internal_installments where case_id='{winner}' and sequence=2")
 chain_ids=['10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005']
 for rid in chain_ids:
  ok('ENTRY_CREATE',dict(id=rid,case_id=winner,installment_id=second,kind='RECEIPT',amount=300,date='2026-11-10',holder='OWNER',reference=rid,category='Rent',note=''))
 review=dict(id=chain_ids[0],status='APPROVED',note='Manager review')
 results=race(f"select pg_advisory_xact_lock(hashtextextended('{chain_ids[0]}',0))",[command(admin,'ENTRY_DECIDE',review),command(admin,'ENTRY_DECIDE',review)])
 assert sorted(r[0]==0 for r in results)==[False,True],results
 assert sql(f"select status from portal_private.internal_entries where id='{chain_ids[0]}'")=='PENDING'
 ok('ENTRY_DECIDE',dict(id=chain_ids[1],status='APPROVED',note='Manager review'))
 results=race(f"select id from portal_private.leasing_cases where id='{winner}' for update",[command(ceo,'ENTRY_DECIDE',dict(id=rid,status='APPROVED',note='Final review')) for rid in chain_ids])
 assert sorted(r[0]==0 for r in results)==[False,True],results
 assert sql(f"select sum(amount) from portal_private.internal_entries where installment_id='{second}' and status='APPROVED'")=='300.00'
 sql(f"update portal_private.leasing_cases set assignee_id='{admin}' where id='{winner}'; update portal_private.leasing_followups set completed_at=now();")
 results=race(f"select pg_advisory_xact_lock(hashtextextended('{admin}:assistant-plan',0))",[command(admin,'ASSISTANT_PLAN',dict(id='10000000-0000-4000-8000-00000000000'+str(i))) for i in (6,7)])
 assert all(r[0]==0 for r in results),results
 assert sql("select count(*) from portal_private.leasing_followups where origin='LEASING_ASSISTANT'")=='1'
 print('PostgreSQL 17 approval chain concurrency passed: one manager transition, final collection limits, no duplicate assistant tasks')
finally:
 if created:subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
