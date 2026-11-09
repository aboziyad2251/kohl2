"""Approved disposable PostgreSQL concurrency checks; never connects to a live DB."""
import concurrent.futures, json, pathlib, subprocess, time
name = 'kohl_payout_isolated_20261109'
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
    return f"begin; set local role authenticated; set local statement_timeout='12s'; select set_config('request.jwt.claim.sub','{actor}',true); select public.broker_payout_requests('{op}','{data}'::jsonb); commit;"
def rpc(actor,op,payload):return process(command(actor,op,payload))
def race(contract,commands):
    holder=subprocess.Popen(['docker','exec','-i',name,'psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    holder.stdin.write(f"begin; select contract_id from portal_private.broker_contract_links where contract_id='{contract}' for update; select 'LOCKED';\n");holder.stdin.flush()
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
assert subprocess.run(['docker','container','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'Inspect leftover test container before reuse'
created=False
try:
    subprocess.run(['docker','run','-d','--pull','never','--name',name,'--label','kohl.test=payout-isolated','--network','none','--memory','512m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac'],check=True,stdout=subprocess.DEVNULL)
    created=True
    info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
    assert info['HostConfig']['NetworkMode']=='none' and not info['HostConfig'].get('PortBindings')
    assert not any(m['Type']=='bind' for m in info['Mounts'])
    for _ in range(60):
        if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        time.sleep(.25)
    sql("""create role anon; create role authenticated; create schema auth;create schema portal_private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,portal_private to authenticated,anon;
    create table portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean);
    create table public.contracts(id uuid primary key,contract_number text,rent_amount numeric,start_date date,end_date date,office_profit numeric);
    create table portal_private.broker_office_agreements(id uuid primary key,broker_user_id uuid,commission_type text,commission_value numeric,percentage_basis text);
    create table portal_private.broker_contract_links(broker_user_id uuid,contract_id uuid,agreement_id uuid,commission_type text,commission_value numeric,percentage_basis text,payout_status text default 'pending',closed_at timestamptz,primary key(broker_user_id,contract_id));""")
    workflow_file=root/'role_portal_workflows.sql'
    if not workflow_file.exists():workflow_file=root.parent/'supabase/migrations/20261005161549_role_portal_workflows.sql'
    workflow=workflow_file.read_text()
    start=workflow.index('create function portal_private.contract_value(');end=workflow.index('$$;',start)+3
    sql(workflow[start:end])
    for identity,role in [(admin,'ADMIN'),(ceo,'CEO'),(broker,'BROKER'),(other,'BROKER')]:sql(f"insert into portal_private.accounts values('{identity}','Fixture {role}','{role}',true)")
    sql(f"insert into portal_private.broker_office_agreements values('{agreement}','{broker}','PERCENTAGE',10,'DEAL_VALUE')")
    for c in [c1,c2]:sql(f"insert into public.contracts values('{c}','FIXTURE',5000,'2026-01-01','2026-12-31',1000);insert into portal_private.broker_contract_links(broker_user_id,contract_id,agreement_id,closed_at) values('{broker}','{c}','{agreement}',now()-interval '1 day')")
    migration_file=root/'broker_payout_requests.sql'
    if not migration_file.exists():migration_file=root.parent/'supabase/migrations/20261109003906_broker_payout_requests.sql'
    sql(migration_file.read_text())
    results=race(c1,[command(broker,'SUBMIT',{'request_id':r,'contract_id':c1}) for r in [r1,r2]])
    assert sorted(x[0] for x in results)==[0,3],[(x[0],x[2][:100]) for x in results]
    assert any('23505' in x[2] for x in results)
    assert sql('select count(*) from portal_private.broker_payout_requests')=='1'
    winner=sql('select id from portal_private.broker_payout_requests')
    results=race(c2,[command(broker,'SUBMIT',{'request_id':r3,'contract_id':c2})]*2)
    assert all(x[0]==0 for x in results)
    assert sql(f"select jsonb_array_length(history) from portal_private.broker_payout_requests where id='{r3}'")=='1'
    results=race(c1,[command(admin,'DECIDE',{'request_id':winner,'status':'approved','note':'Reviewed'}),command(ceo,'DECIDE',{'request_id':winner,'status':'rejected','note':'Missing evidence'})])
    assert sorted(x[0] for x in results)==[0,3] and any('40001' in x[2] for x in results)
    assert sql(f"select jsonb_array_length(history) from portal_private.broker_payout_requests where id='{winner}'")=='2'
    for op,payload,actor in [('LIST',{},other),('LIST',{},broker),('LIST',{},admin)]:
        rc,out,err=rpc(actor,op,payload);assert rc==0
        result=json.loads(out.splitlines()[-1]);assert result['total']==(0 if actor==other else 2)
    rc,out,err=rpc(broker,'DECIDE',{'request_id':r3,'status':'approved'});assert rc!=0 and '42501' in err
    rc,out,err=process(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{broker}',true);select * from portal_private.broker_payout_requests;commit;");assert rc!=0 and '42501' in err
    sql(f"update public.contracts set rent_amount=6000 where id='{c2}'")
    rc,out,err=rpc(admin,'DECIDE',{'request_id':r3,'status':'approved'});assert rc!=0 and '40001' in err
    assert sql("select count(*) from portal_private.broker_contract_links where payout_status<>'pending'")=='0'
    receipt={'passed':True,'postgres_version':sql('show server_version'),'image_id':info['Image'],'network':'none','ports':False,'production_credentials':False,'concurrent_waiters_proven':2,'checks':['different-id duplicate race','same-id retry race','Admin/CEO competing decisions','broker isolation/counts','broker decision/direct-table denial','stale amount','no financial mutations']}
    output=root.parent/'.portal-stage/payout-postgres-acceptance.json' if (root.parent/'.git').exists() else root/'postgres-acceptance.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(receipt))
    print(json.dumps(receipt))
finally:
    if created:
        info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
        assert info['Config']['Labels'].get('kohl.test')=='payout-isolated' and info['HostConfig']['NetworkMode']=='none'
        subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
        print('ISOLATED_POSTGRES_REMOVED=True')
