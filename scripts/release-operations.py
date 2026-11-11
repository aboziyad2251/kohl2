"""Reviewed main-app cutover. Default is read-only dry run; --apply requires release approval.
Private plan/runtime files and logs must never be shared. Additive SQL is retained on app rollback.
"""
import argparse
import copy
import datetime
import fcntl
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
from contextlib import contextmanager
import urllib.error
import urllib.request
import urllib.parse

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('preparation',ROOT/'scripts/prepare-operations-release.py')
prep=importlib.util.module_from_spec(spec);spec.loader.exec_module(prep)

LOCK_PATH=Path('/home/debian/backups/.kohl-operations-release.lock')
EXPECTED_HASHES={'20261110143135_leasing_internal_finance.sql': 'd93b2e2be0e2cd6c9a3feb884dd2a53cfecb755035b97c65b8c3864c3a8aa522', '20261110215449_operations_private_documents.sql': 'ac943cebd65a7e3345182e9ec21fd8e4baeb7957051dd9adaa6f555e850400ff'}

@contextmanager
def release_lock():
    # One host-wide lock, including plans created by repeated preparation runs.
    with LOCK_PATH.open('a') as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another operations release or rollback is active') from None
        yield


def interrupted(signum, frame):
    raise InterruptedError('Release interrupted; inspect private receipts')


class Engine(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')

def api(method,path,body=None):
    conn=Engine('localhost',timeout=40)
    try:
        conn.request(method,'/v1.41'+path,json.dumps(body) if body is not None else None,{'Content-Type':'application/json'})
        response=conn.getresponse();data=response.read()
        if response.status>=300:raise RuntimeError('Docker operation failed: '+str(response.status))
        return json.loads(data) if data else None
    finally:conn.close()

@contextmanager
def directory_fd(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try:yield fd
    finally:os.close(fd)


def write_private(path,value):
    temporary=path.with_suffix('.tmp')
    with temporary.open('w') as f:
        os.fchmod(f.fileno(),0o600)
        json.dump(value,f,indent=2);f.flush();os.fsync(f.fileno())
    temporary.replace(path)
    with directory_fd(path.parent) as fd:
        os.fsync(fd)

def env(config):
    return dict(x.split('=',1) for x in config.get('Env',[]) if '=' in x)

def migration_sql(contents):
    bodies=[]
    for text in contents:
        lines=text.splitlines()
        starts=[i for i,line in enumerate(lines) if line.strip()=='begin;']
        ends=[i for i,line in enumerate(lines) if line.strip()=='commit;']
        if len(starts)!=1 or len(ends)!=1 or starts[0]>=ends[0]:
            raise RuntimeError('Unexpected migration transaction structure')
        bodies.append('\n'.join(lines[starts[0]+1:ends[0]]))
    return """BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$BEGIN
 IF NOT pg_try_advisory_xact_lock(6149230111) THEN
  RAISE EXCEPTION 'Another operations release is active';
 END IF;
END$$;
"""+'\n'.join(bodies)+'\nCOMMIT;\n'

def payload(old,image,release):
    if old['HostConfig'].get('AutoRemove'):
        raise RuntimeError('Auto-remove would destroy the rollback container')
    if old.get('Mounts') or old['Config'].get('Volumes'):
        raise RuntimeError('Unexpected main mounts or declared volumes')
    for endpoint in old['NetworkSettings']['Networks'].values():
        if endpoint.get('IPAMConfig') or endpoint.get('Links') or endpoint.get('DriverOpts'):
            raise RuntimeError('Static network configuration requires separate review')
    config=copy.deepcopy(old['Config'])
    config['Image']=image
    config['Labels']={**(config.get('Labels') or {}),'kohl.operations.release':release}
    config['HostConfig']=copy.deepcopy(old['HostConfig'])
    primary=old['HostConfig']['NetworkMode']
    endpoints={name:{'Aliases':entry.get('Aliases') or []}
               for name,entry in old['NetworkSettings']['Networks'].items()}
    if primary not in endpoints:raise RuntimeError('Unexpected primary network')
    config['NetworkingConfig']={'EndpointsConfig':{primary:endpoints[primary]}}
    return config,primary,endpoints

def database(statement,log):
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres',
                           '-d','postgres','-v','ON_ERROR_STOP=1'],
                          input=statement.encode(),stdout=subprocess.PIPE,stderr=log,timeout=150)
    if result.returncode:raise RuntimeError('Database command failed; inspect private log before retrying')
    return result.stdout.decode().strip()

def absence(log):
    statement="""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT to_regprocedure('public.kohl_operations(text,jsonb)') IS NULL
 AND to_regprocedure('public.operations_document(uuid,text,jsonb)') IS NULL
 AND to_regprocedure('public.operations_kr_summary(date)') IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='portal_private'
 AND tablename IN ('leasing_cases','leasing_units','leasing_followups',
 'internal_dues','internal_installments','internal_entries','operations_documents',
 'operations_history','operations_replays','operations_exports'))
 AND NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='kohl-finance-documents');
ROLLBACK;"""
    if database(statement,log)!='t':raise RuntimeError('Operations schema already exists or differs; no automatic reapply')

def nginx(action,log):
    subprocess.run(['docker','exec','nginx_proxy_manager','nginx',*action],
                   stdout=log,stderr=log,check=True,timeout=30)

def health(container):
    code="""(async()=>{for(const [path,expected] of [['/login',200],['/api/operations',401]]) {
const r=await fetch('http://127.0.0.1:3000'+path,{signal:AbortSignal.timeout(3000)});
if(r.status!==expected)process.exit(1);}})().catch(()=>process.exit(1));"""
    for _ in range(30):
        result=subprocess.run(['docker','exec',container,'node','-e',code],
                              stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
        if result.returncode==0:return
        time.sleep(1)
    raise RuntimeError('Candidate health checks failed')

def public_health(operations=True):
    routes=[('/login',200),('/api/operations',401)] if operations else [('/login',200)]
    for path,expected in routes:
        try:
            with urllib.request.urlopen('https://app.kohlestate-ksa.online'+path,timeout=12) as r:status=r.status
        except urllib.error.HTTPError as error:status=error.code
        if status!=expected:raise RuntimeError('Public route check failed')

def untouched(originals):
    for name in ('kohl_broker_frontend','kohl_account_frontend'):
        current=prep.inspect(name)
        if current['Id']!=originals[name]['Id'] or current['Image']!=originals[name]['Image'] or not current['State']['Running']:
            raise RuntimeError('Preserved frontend changed')

def parked_host(original):
    host=copy.deepcopy(original['HostConfig'])
    host['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
    return host

def rollback(original,release,log):
    # Identify by saved IDs/our release label, never delete an unrelated container.
    saved=prep.inspect(original['Id'])
    if (saved['Image']!=original['Image'] or saved['Config']!=original['Config'] or
        saved['HostConfig'] not in (original['HostConfig'],parked_host(original))):
        raise RuntimeError('Original rollback container changed; manual inspection required')
    # A failed inspect must not be interpreted as proof the name is free.
    matches=api('GET','/containers/json?all=true&filters='+urllib.parse.quote(json.dumps({'name':['^/kohl_crm_app$']})))
    if matches:
        if len(matches)!=1:raise RuntimeError('Ambiguous main container lookup')
        current=prep.inspect(matches[0]['Id'])
        if current['Id']!=original['Id']:
            if ((current['Config'].get('Labels') or {}).get('kohl.operations.release')!=release or
                current['Image']!=prep.CANDIDATE):
                raise RuntimeError('Rollback blocked by an unrelated main container')
            api('DELETE','/containers/'+current['Id']+'?force=true')
    saved=prep.inspect(original['Id'])
    if saved['Name']!='/kohl_crm_app':
        api('POST','/containers/'+original['Id']+'/rename?name=kohl_crm_app')
    if saved['HostConfig']!=original['HostConfig']:
        api('POST','/containers/'+original['Id']+'/update',{'RestartPolicy':original['HostConfig']['RestartPolicy']})
    if not prep.inspect(original['Id'])['State']['Running']:
        api('POST','/containers/'+original['Id']+'/start')
    nginx(['-t'],log);nginx(['-s','reload'],log)
    # The old version has no operations API; verify its login only.
    code="fetch('http://127.0.0.1:3000/login',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
    for _ in range(30):
        if subprocess.run(['docker','exec',original['Id'],'node','-e',code],stdout=log,stderr=log,timeout=8).returncode==0:
            public_health(operations=False)
            return
        time.sleep(1)
    raise RuntimeError('Original application did not recover')

def cutover(original,candidate,originals,folder,log):
    release=folder.parent.name+'-'+folder.name
    previous='kohl_crm_app_before_operations_'+release
    config,primary,endpoints=payload(candidate,prep.CANDIDATE,release)
    journal={'release':release,'phase':'before-stop','original_id':original['Id'],'previous_name':previous,
             'candidate_image':prep.CANDIDATE,'database_rollback':'retain additive schema/data'}
    write_private(folder/'cutover.json',journal)
    try:
        # Retain rollback without letting it compete for ports after daemon restart.
        api('POST','/containers/'+original['Id']+'/update',{'RestartPolicy':parked_host(original)['RestartPolicy']})
        api('POST','/containers/'+original['Id']+'/stop?t=20')
        api('POST','/containers/'+original['Id']+'/rename?name='+previous)
        journal['phase']='old-stopped';write_private(folder/'cutover.json',journal)
        created=api('POST','/containers/create?name=kohl_crm_app',config)
        journal.update(phase='candidate-created',candidate_id=created['Id'])
        write_private(folder/'cutover.json',journal)
        for network,endpoint in endpoints.items():
            if network!=primary:
                api('POST','/networks/'+network+'/connect',{'Container':created['Id'],'EndpointConfig':endpoint})
        api('POST','/containers/'+created['Id']+'/start')
        actual=prep.inspect(created['Id'])
        if (actual['Image']!=prep.CANDIDATE or env(actual['Config'])!=env(candidate['Config']) or
            actual['HostConfig']!=candidate['HostConfig'] or
            set(actual['NetworkSettings']['Networks'])!=set(endpoints)):
            raise RuntimeError('Candidate runtime mismatch')
        for name,endpoint in endpoints.items():
            if not set(endpoint['Aliases']).issubset(actual['NetworkSettings']['Networks'][name].get('Aliases') or []):
                raise RuntimeError('Candidate network aliases differ')
        health(created['Id']);nginx(['-t'],log);nginx(['-s','reload'],log)
        public_health();untouched(originals)
        journal['phase']='live';write_private(folder/'cutover.json',journal)
    except BaseException:
        # A second ordinary termination signal must not interrupt recovery.
        signal.signal(signal.SIGTERM,signal.SIG_IGN)
        signal.signal(signal.SIGINT,signal.SIG_IGN)
        try:
            rollback(original,release,log);untouched(originals)
            journal['phase']='rolled-back';write_private(folder/'cutover.json',journal)
        except Exception:
            journal['phase']='rollback-needs-attention';write_private(folder/'cutover.json',journal)
            raise RuntimeError('Cutover failed; automatic app rollback needs attention. See private cutover receipt.')
        raise RuntimeError('Cutover failed; original application restored. Additive schema/data retained.')

def validate(plan_dir):
    plan=json.loads((plan_dir/'plan.json').read_text())
    originals=json.loads((plan_dir/'runtime-original.private.json').read_text())
    candidate=json.loads((plan_dir/'runtime-candidate.private.json').read_text())
    if plan['source']!=prep.SOURCE or plan['image']!=prep.CANDIDATE:raise RuntimeError('Unreviewed source/image')
    if prep.inspect(prep.CANDIDATE,True)['Id']!=prep.CANDIDATE:raise RuntimeError('Candidate image missing')
    if set(originals)!=set(prep.LIVE):raise RuntimeError('Incomplete original runtime snapshot')
    if plan.get('migration_hashes')!=EXPECTED_HASHES:
        raise RuntimeError('Plan does not match the reviewed migration hashes')
    contents=[]
    for name in prep.MIGRATIONS:
        data=(ROOT/'supabase/migrations'/name).read_bytes()
        if hashlib.sha256(data).hexdigest()!=plan['migration_hashes'][name]:raise RuntimeError('Migration changed since preparation')
        contents.append(data.decode())
    transaction=migration_sql(contents)
    for name,saved in originals.items():
        current=prep.inspect(name)
        if (current['Id']!=saved['Id'] or current['Image']!=prep.LIVE[name] or saved['Image']!=prep.LIVE[name] or
            not current['State']['Running'] or current['Config']!=saved['Config'] or
            current['HostConfig']!=saved['HostConfig'] or
            current['NetworkSettings']['Networks']!=saved['NetworkSettings']['Networks']):
            raise RuntimeError('Live runtime changed; create a new reviewed plan')
    refreshed=prep.prepare_runtime(originals['kohl_crm_app'],Path('/home/debian/.config/kohl/hatif.env'))
    if refreshed!=candidate:raise RuntimeError('Hatif or prepared runtime changed')
    payload(candidate,prep.CANDIDATE,'validation')
    return plan,originals,candidate,transaction


def recover(plan_dir,folder,approved_image):
    if folder.resolve().parent!=plan_dir.resolve():
        raise RuntimeError('Recovery directory must belong to this plan')
    marker=json.loads((plan_dir/'apply-started.json').read_text())
    if Path(marker['directory']).resolve()!=folder.resolve():
        raise RuntimeError('Recovery directory does not match the apply receipt')
    originals=json.loads((plan_dir/'runtime-original.private.json').read_text())
    original=originals['kohl_crm_app']
    if approved_image!=prep.LIVE['kohl_crm_app'] or original['Image']!=approved_image:
        raise RuntimeError('Rollback requires approval of the exact original image')
    journal=json.loads((folder/'cutover.json').read_text())
    release=folder.parent.name+'-'+folder.name
    if journal['original_id']!=original['Id'] or journal.get('release')!=release:
        raise RuntimeError('Recovery receipt does not match the saved original')
    with (folder/'rollback.private.log').open('ab') as log:
        try:
            rollback(original,release,log);untouched(originals)
            journal['phase']='rolled-back'
        except BaseException:
            journal['phase']='rollback-needs-attention'
            write_private(folder/'cutover.json',journal)
            raise
    write_private(folder/'cutover.json',journal)
    print('ROLLBACK OK: original main restored; additive schema/data retained; frontends unchanged.')


def execute(args):
    if args.rollback:
        recover(args.plan,args.rollback,args.approved_image)
        return
    if args.apply and args.approved_image!=prep.CANDIDATE:
        raise RuntimeError('--apply requires the explicitly approved exact image ID')
    plan,originals,candidate,transaction=validate(args.plan)
    with open(os.devnull,'wb') as quiet:
        absence(quiet);nginx(['-t'],quiet)
    if not args.apply:
        print('DRY RUN OK: fresh backup → atomic migrations → replace main only → health/public checks.')
        print('Hatif/ports/networks preserved; broker/account unchanged; automatic app rollback on cutover failure.')
        print('No deployment or database mutation performed.')
        return
    marker=args.plan/'apply-started.json'
    if marker.exists():raise RuntimeError('This plan was already attempted; inspect receipts before retrying')
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder=args.plan/('release-'+stamp);folder.mkdir(mode=0o700)
    write_private(marker,{'directory':str(folder.resolve()),'image':prep.CANDIDATE})
    print('Private release directory: '+str(folder),flush=True)
    with (folder/'private.log').open('wb') as log:
        archive=folder/'postgres-before.dump'
        with archive.open('xb') as out:
            subprocess.run(['docker','exec','supabase-db','pg_dump','-U','postgres','-d','postgres',
                            '--format=custom','--lock-wait-timeout=15s'],stdout=out,stderr=log,check=True,timeout=600)
            out.flush();os.fsync(out.fileno())
        with archive.open('rb') as inp:
            subprocess.run(['docker','exec','-i','supabase-db','pg_restore','--list'],stdin=inp,stdout=log,stderr=log,check=True,timeout=120)
        # Backup may take minutes: revalidate Hatif and runtime before any mutation.
        validate(args.plan)
        absence(log)
        receipt={'hashes':plan['migration_hashes'],'state':'started-outcome-unknown'}
        write_private(folder/'migration.json',receipt)
        print('Fresh backup archive listing checked; applying the two reviewed migrations atomically.',flush=True)
        database(transaction,log)
        receipt['state']='committed';write_private(folder/'migration.json',receipt)
        print('Migrations committed; switching main application.',flush=True)
        validate(args.plan)
        cutover(originals['kohl_crm_app'],candidate,originals,folder,log)
    print('RELEASE OK: main switched; Hatif preserved; broker/account unchanged. Keep backup and old container.')
    print('User sign-in and business-flow confirmation still required.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan',required=True,type=Path)
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--apply',action='store_true')
    modes.add_argument('--rollback',type=Path,metavar='PRIVATE_RELEASE_DIRECTORY')
    parser.add_argument('--approved-image')
    args=parser.parse_args()
    os.umask(0o077)
    signal.signal(signal.SIGTERM,interrupted)
    if args.apply or args.rollback:
        with release_lock():execute(args)
    else:execute(args)


if __name__=='__main__':
    try:main()
    except (Exception,KeyboardInterrupt) as error:
        print('STOP: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__))
        print('Do not share private logs/runtime files. Inspect receipts before any retry.')
        raise SystemExit(1)
