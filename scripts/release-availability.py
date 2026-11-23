"""Pinned availability cutover. Default: read-only production checks, no deployment.

Use only the rehearsed private availability plan. --apply requires the approved
exact image. Recovery restores the original app, retaining the additive schema and all data.
"""
import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import urllib.parse
import re
import shutil
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
CANDIDATE = 'sha256:9bae346387ec38d2eadf79360e67bdb5a5078a2acc2c32711a1b7d275d3a078e'


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prep = load('availability_preparation', 'prepare-availability-release.py')
# Import inert definitions only. Never invoke the historical execute/main,
# validate, cutover, or rollback paths with their old images/migrations.
shared = load('operations_release_helpers', 'release-operations.py')
api = shared.api
write_private = shared.write_private
database = shared.database
nginx = shared.nginx
health = shared.health
public_health = shared.public_health
payload = shared.payload
env = shared.env
release_lock = shared.release_lock


CONFIG_KEY = 'portal_private.operations_approval_config'
CONFIG_DIGEST = "(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) FROM portal_private.operations_approval_config t)"


def config_hash(plan):
    value=plan.get('rehearsal_fingerprints',{}).get(CONFIG_KEY)
    if not isinstance(value,str) or not re.fullmatch(r'[0-9a-f]{32}',value):
        raise RuntimeError('Invalid prepared reviewer fingerprint')
    return value


def transaction(plan):
    content = prep.migration_sql()  # Both pinned hashes checked before any SQL.
    expected = config_hash(plan)
    guard = f"""
DO $$BEGIN
 IF NOT pg_try_advisory_xact_lock(6149230111) THEN
  RAISE EXCEPTION 'Another operations release is active';
 END IF;
END$$;
LOCK TABLE portal_private.operations_approval_config IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE portal_private.accounts IN SHARE MODE;
DO $availability_guard$ BEGIN
 IF {CONFIG_DIGEST} IS DISTINCT FROM '{expected}'
 OR NOT EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
 JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
 JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active WHERE c.singleton)
 THEN RAISE EXCEPTION 'Reviewer configuration changed'; END IF;
 IF to_regclass('portal_private.leasing_holds') IS NOT NULL
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='portal_private'
 AND table_name='leasing_followups' AND column_name='category')
 THEN RAISE EXCEPTION 'Availability migration already present'; END IF;
END $availability_guard$;
"""
    first, rest = content.split('\n', 1)
    # Verify initial grants inside the same transaction: no partial/unsafe commit.
    verify = "\nDO $verify$ BEGIN IF NOT (" + prep.VERIFY.strip().removeprefix('SELECT').rstrip(';') + ") THEN RAISE EXCEPTION 'Availability verification failed'; END IF; END $verify$;\n"
    return first + '\n' + guard + rest.replace('\nCOMMIT;', verify + '\nCOMMIT;')


def reviewer_unchanged(plan, log):
    expected=config_hash(plan)
    sql=f"BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT {CONFIG_DIGEST}='{expected}'; ROLLBACK;"
    if database(sql,log)!='t':raise RuntimeError('Reviewers changed since rehearsal')


def preflight(plan, log):
    flags=json.loads(database("BEGIN READ ONLY; SET LOCAL statement_timeout='15s';\n"+prep.PREREQUISITES+'\nROLLBACK;',log))
    if not flags or any(value is not True for value in flags.values()):
        raise RuntimeError('Availability migration already exists or prerequisites changed')
    reviewer_unchanged(plan,log)


def verify_applied(plan, log):
    if database("BEGIN READ ONLY; SET LOCAL statement_timeout='15s';\n"+prep.VERIFY+'\nROLLBACK;',log)!='t':
        raise RuntimeError('Committed availability migrations failed privilege checks; no automatic reapply')
    reviewer_unchanged(plan,log)


def candidate_health(container):
    health(container)
    code="(async()=>{for(const p of ['/api/auth/leasing-switch','/api/operations/availability','/api/operations/reservations']){const r=await fetch('http://127.0.0.1:3000'+p,{signal:AbortSignal.timeout(5000)});if(r.status!==401)process.exit(1)}})().catch(()=>process.exit(1))"
    subprocess.run(['docker','exec',container,'node','-e',code],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20)


def public_availability_health():
    public_health()
    for path in ('/api/auth/leasing-switch', '/api/operations/availability', '/api/operations/reservations'):
        try:
            with urllib.request.urlopen('https://app.kohlestate-ksa.online'+path, timeout=12) as response:
                status = response.status
        except urllib.error.HTTPError as error:
            status = error.code
        if status != 401:
            raise RuntimeError('Public availability route check failed')


def read_plan(directory):
    plan = json.loads((directory/'plan.private.json').read_text())
    originals = json.loads((directory/'runtime-original.private.json').read_text())
    candidate = json.loads((directory/'runtime-candidate.private.json').read_text())
    if (plan.get('mode') != 'PREPARE_ONLY' or plan.get('application_source') != prep.SOURCE
            or plan.get('image') != CANDIDATE or plan.get('migrations') != prep.MIGRATIONS or plan.get('previous_images') != prep.LIVE
            or plan.get('database_image') != prep.restore.IMAGE or plan.get('production_changed') is not False
            or plan.get('hatif_matches_live') is not True or set(originals) != set(prep.LIVE)
            or plan.get('account_recovery_disabled') is not True
            or plan.get('fresh_backup_required_at_cutover') is not True):
        raise RuntimeError('Private plan does not match the reviewed availability release')
    config_hash(plan)
    receipt_path=directory/'http-receipt.private.json'
    if prep.base.digest(receipt_path)!=plan.get('http_receipt_sha256'):
        raise RuntimeError('HTTP acceptance receipt changed')
    prep.validate_receipt(receipt_path, CANDIDATE)
    for name, original in originals.items():
        if original['Image'] != prep.LIVE[name]:
            raise RuntimeError('Saved runtime image differs from the reviewed original')
    return plan, originals, candidate


def validate(directory):
    plan, originals, candidate = read_plan(directory)
    built = prep.base.inspect(CANDIDATE, image=True)
    if built['Id'] != CANDIDATE or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision') != prep.SOURCE:
        raise RuntimeError('Accepted image is missing or its source label differs')
    archive = Path(plan['backup'])
    if archive.resolve().parent != directory.resolve() or prep.base.digest(archive) != plan['backup_sha256']:
        raise RuntimeError('Rehearsed backup is missing, moved or changed')
    if prep.base.inspect('supabase-db')['Image'] != prep.restore.IMAGE:
        raise RuntimeError('Database image changed')
    sql = transaction(plan)
    for name, original in originals.items():
        current = prep.base.inspect(name)
        if (any(current[key] != original[key] for key in ('Id','Image','Config','HostConfig'))
                or current['NetworkSettings']['Networks'] != original['NetworkSettings']['Networks']
                or not current['State']['Running'] or current['State']['StartedAt'] != original['State']['StartedAt']):
            raise RuntimeError('Live runtime changed since approval preparation')
    refreshed = prep.base.candidate_runtime(originals['kohl_crm_app'], CANDIDATE)
    if refreshed != candidate:
        raise RuntimeError('Hatif or candidate runtime changed since preparation')
    if prep.base.env(originals['kohl_account_frontend']).get('PASSWORD_RECOVERY_ENABLED') != 'false':
        raise RuntimeError('Account recovery must remain disabled')
    roles = Path(plan['roles_file'])
    if roles.resolve().parent != directory.resolve() or prep.base.digest(roles) != plan['roles_sha256']:
        raise RuntimeError('Rehearsed role definitions changed')
    payload(candidate, CANDIDATE, 'validation')
    return plan, originals, candidate, sql


def unchanged_frontends(originals):
    for name in ('kohl_broker_frontend', 'kohl_account_frontend'):
        saved = originals[name]
        current = prep.base.inspect(name)
        if any(current[key] != saved[key] for key in ('Id','Image','Config','HostConfig')) or not current['State']['Running']:
            raise RuntimeError('Preserved frontend changed')


def parked(original):
    result = copy.deepcopy(original['HostConfig'])
    result['RestartPolicy'] = {'Name':'no','MaximumRetryCount':0}
    return result


def rollback(original, release, log):
    saved = prep.base.inspect(original['Id'])
    if saved['Image'] != original['Image'] or saved['Config'] != original['Config'] or saved['HostConfig'] not in (original['HostConfig'], parked(original)):
        raise RuntimeError('Original container changed; manual recovery review required')
    # A rotated persistent secret must never be replaced by the old snapshot.
    prep.base.candidate_runtime(original, CANDIDATE)
    matches = api('GET', '/containers/json?all=true&filters='+urllib.parse.quote(json.dumps({'name':['^/kohl_crm_app$']})))
    remove_id=None
    if matches:
        if len(matches) != 1:
            raise RuntimeError('Ambiguous main container lookup')
        current = prep.base.inspect(matches[0]['Id'])
        if current['Id'] != original['Id']:
            if current['Image'] != CANDIDATE or (current['Config'].get('Labels') or {}).get('kohl.operations.release') != release:
                raise RuntimeError('Recovery blocked by an unrelated main container')
            remove_id=current['Id']
    if remove_id is not None:api('DELETE','/containers/'+remove_id+'?force=true')
    saved = prep.base.inspect(original['Id'])
    if saved['Name'] != '/kohl_crm_app':
        api('POST', '/containers/'+original['Id']+'/rename?name=kohl_crm_app')
    if saved['HostConfig'] != original['HostConfig']:
        api('POST', '/containers/'+original['Id']+'/update', {'RestartPolicy':original['HostConfig']['RestartPolicy']})
    if not prep.base.inspect(original['Id'])['State']['Running']:
        api('POST', '/containers/'+original['Id']+'/start')
    health(original['Id'])
    nginx(['-t'], log)
    nginx(['-s','reload'], log)
    public_health()


def cutover(originals, candidate, folder, log):
    original = originals['kohl_crm_app']
    release = folder.parent.name+'-'+folder.name
    previous = 'kohl_crm_app_before_availability_'+release
    config, primary, endpoints = payload(candidate, CANDIDATE, release)
    journal = {'release':release,'phase':'before-stop','original_id':original['Id'],
               'previous_name':previous,'candidate_image':CANDIDATE,
               'database_rollback':'Retain additive schema, occupancy guards and all booking/financial/audit data; app-only rollback'}
    write_private(folder/'cutover.private.json', journal)
    # Last Hatif check before the first main-container mutation.
    if prep.base.candidate_runtime(original, CANDIDATE) != candidate:
        raise RuntimeError('Hatif changed before main stop')
    try:
        api('POST', '/containers/'+original['Id']+'/update', {'RestartPolicy':parked(original)['RestartPolicy']})
        api('POST', '/containers/'+original['Id']+'/stop?t=20')
        api('POST', '/containers/'+original['Id']+'/rename?name='+previous)
        journal['phase'] = 'old-stopped'; write_private(folder/'cutover.private.json', journal)
        created = api('POST', '/containers/create?name=kohl_crm_app', config)
        journal.update(phase='candidate-created', candidate_id=created['Id'])
        write_private(folder/'cutover.private.json', journal)
        for network, endpoint in endpoints.items():
            if network != primary:
                api('POST', '/networks/'+network+'/connect', {'Container':created['Id'],'EndpointConfig':endpoint})
        api('POST', '/containers/'+created['Id']+'/start')
        actual = prep.base.inspect(created['Id'])
        if (actual['Image'] != CANDIDATE or env(actual['Config']) != env(candidate['Config'])
                or actual['HostConfig'] != candidate['HostConfig']
                or set(actual['NetworkSettings']['Networks']) != set(endpoints)):
            raise RuntimeError('New container runtime mismatch')
        for network, endpoint in endpoints.items():
            if not set(endpoint['Aliases']).issubset(actual['NetworkSettings']['Networks'][network].get('Aliases') or []):
                raise RuntimeError('New container network aliases differ')
        candidate_health(created['Id'])
        nginx(['-t'], log); nginx(['-s','reload'], log)
        public_availability_health(); unchanged_frontends(originals)
        journal['phase'] = 'live'; write_private(folder/'cutover.private.json', journal)
    except BaseException:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        try:
            rollback(original, release, log); unchanged_frontends(originals)
            journal['phase'] = 'rolled-back'; write_private(folder/'cutover.private.json', journal)
        except BaseException:
            journal['phase'] = 'recovery-needs-attention'; write_private(folder/'cutover.private.json', journal)
            raise RuntimeError('Cutover failed; recovery needs attention. Inspect private receipts.') from None
        raise RuntimeError('Original app restored; additive schema and all data retained.') from None


def fresh_backup(folder, log):
    size=int(database("BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT pg_database_size(current_database()); ROLLBACK;",log))
    if shutil.disk_usage(folder).free<size*2+512*1024**2:
        raise RuntimeError('Insufficient space for fresh backup')
    archive = folder/'postgres-before.dump'
    with archive.open('xb') as stream:
        subprocess.run(['docker','exec','supabase-db','pg_dump','-U','postgres','-d','postgres',
                        '--format=custom','--lock-wait-timeout=15s'], check=True, stdout=stream, stderr=log, timeout=600)
        stream.flush(); os.fsync(stream.fileno())
    if archive.stat().st_size == 0:
        raise RuntimeError('Fresh backup is empty')
    with archive.open('rb') as stream:
        subprocess.run(['docker','exec','-i','supabase-db','pg_restore','--list'], check=True,
                       stdin=stream, stdout=log, stderr=log, timeout=120)


def recover(directory, folder, approved_image):
    plan, originals, candidate = read_plan(directory)
    if approved_image != prep.LIVE['kohl_crm_app']:
        raise RuntimeError('Recovery requires approval of the exact original image')
    marker = json.loads((directory/'apply-started.private.json').read_text())
    if folder.resolve().parent != directory.resolve() or Path(marker['directory']).resolve() != folder.resolve() or marker['image'] != CANDIDATE:
        raise RuntimeError('Recovery directory does not match this release attempt')
    journal = json.loads((folder/'cutover.private.json').read_text())
    release = folder.parent.name+'-'+folder.name
    if journal['release'] != release or journal['original_id'] != originals['kohl_crm_app']['Id'] or journal['candidate_image'] != CANDIDATE:
        raise RuntimeError('Recovery journal differs from the original runtime')
    with (folder/'recovery.private.log').open('ab') as log:
        try:
            rollback(originals['kohl_crm_app'], release, log); unchanged_frontends(originals)
            journal['phase'] = 'rolled-back'
        except BaseException:
            journal['phase'] = 'recovery-needs-attention'
            write_private(folder/'cutover.private.json', journal)
            raise
    write_private(folder/'cutover.private.json', journal)
    print('RECOVERY OK: original app restored; additive schema and all data retained.')
    print('New availability UI is unavailable; retained occupancy guards can reject unsupported legacy writes.')


def execute(args):
    if args.rollback:
        recover(args.plan, args.rollback, args.approved_image)
        return
    if args.apply and args.approved_image != CANDIDATE:
        raise RuntimeError('Apply requires the approved exact candidate image')
    if (args.plan/'apply-started.private.json').exists():
        raise RuntimeError('This plan was already attempted; inspect receipts before any retry')
    plan, originals, candidate, sql = validate(args.plan)
    with open(os.devnull, 'wb') as quiet:
        preflight(plan, quiet); nginx(['-t'], quiet)
    if not args.apply:
        print('AVAILABILITY DRY RUN OK: exact image, both migrations, reviewers, HTTP acceptance, backup and Hatif validated.')
        print('Apply will take a fresh backup, migrate atomically, switch main only, then verify health.')
        print('No production migration or container mutation performed.')
        return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = args.plan/('release-'+stamp); folder.mkdir(mode=0o700)
    write_private(args.plan/'apply-started.private.json', {'directory':str(folder.resolve()),'image':CANDIDATE})
    print('Private release directory: '+str(folder), flush=True)
    with (folder/'private.log').open('xb') as log:
        fresh_backup(folder, log)
        validate(args.plan); preflight(plan, log)
        receipt = {'migrations':prep.MIGRATIONS,'state':'started-outcome-unknown'}
        write_private(folder/'migration.private.json', receipt)
        print('Fresh backup checked; applying the two reviewed availability migrations atomically.', flush=True)
        database(sql, log)
        receipt['state'] = 'committed'; write_private(folder/'migration.private.json', receipt)
        verify_applied(plan, log)
        validate(args.plan)
        cutover(originals, candidate, folder, log)
    print('AVAILABILITY RELEASE OK: main switched; Hatif preserved; recovery disabled; broker/account unchanged.')
    print('Verify dated apartment search, temporary holds, designated cancellation and categorized follow-ups. Existing units/contracts require explicit mapping; placeholders are not signed originals.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, type=Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--rollback', type=Path)
    parser.add_argument('--approved-image')
    args = parser.parse_args()
    os.umask(0o077)
    signal.signal(signal.SIGTERM, shared.interrupted)
    signal.signal(signal.SIGINT, shared.interrupted)
    try:
        if args.apply or args.rollback:
            with release_lock():
                execute(args)
        else:
            execute(args)
    except Exception as error:
        print('STOP: '+str(error) if isinstance(error, RuntimeError) else 'STOP: release failed ('+type(error).__name__+'); inspect private receipts')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
