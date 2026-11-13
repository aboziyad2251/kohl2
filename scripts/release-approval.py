"""Approval-chain cutover. Default: read-only production checks, no deployment.

Use only the newly rehearsed private approval plan. --apply requires the approved
exact image. Recovery restores the original app, retaining the approval schema/data.
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
import uuid

ROOT = Path(__file__).resolve().parent.parent
CANDIDATE = 'sha256:cc84170de3567a868a6c9605b526744705dc58f469f3055545f2e6e0c5f639a3'


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prep = load('approval_preparation', 'prepare-approval-release.py')
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


def transaction(plan, content):
    if hashlib.sha256(content.encode()).hexdigest() != prep.HASH:
        raise RuntimeError('Unreviewed approval migration')
    manager, final = str(uuid.UUID(plan['manager_id'])), str(uuid.UUID(plan['final_id']))
    if manager == final:
        raise RuntimeError('Approvers must differ')
    settings = f"""SET LOCAL kohl.workflow_manager='{manager}';
SET LOCAL kohl.workflow_final='{final}';
SELECT user_id FROM portal_private.accounts WHERE user_id IN ('{manager}','{final}') ORDER BY user_id FOR SHARE;
"""
    return shared.migration_sql([content]).replace('END$$;\n', 'END$$;\n'+settings, 1)


def preflight(plan, log):
    if database(prep.preflight_sql(plan['manager_id'], plan['final_id']), log) != 't':
        raise RuntimeError('Approval schema already exists or reviewer accounts changed')


def verify_applied(plan, log):
    manager, final = str(uuid.UUID(plan['manager_id'])), str(uuid.UUID(plan['final_id']))
    statement = f"""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
 JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
 JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active
 WHERE c.singleton AND c.manager_id='{manager}' AND c.final_id='{final}' AND c.assistant_enabled)
 AND NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role)
 WHERE has_function_privilege(r.role,'portal_private.operations_core_v1(text,jsonb)','EXECUTE')
 OR has_function_privilege(r.role,'portal_private.document_core_v1(uuid,text,jsonb)','EXECUTE')
 OR has_table_privilege(r.role,'portal_private.operations_approval_config','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 AND NOT has_function_privilege('anon','public.kohl_operations(text,jsonb)','EXECUTE')
 AND has_function_privilege('authenticated','public.kohl_operations(text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.operations_document(uuid,text,jsonb)','EXECUTE')
 AND has_function_privilege('service_role','public.operations_document(uuid,text,jsonb)','EXECUTE');
ROLLBACK;"""
    if database(statement, log) != 't':
        raise RuntimeError('Committed approval schema verification failed; no automatic reapply')


def read_plan(directory):
    plan = json.loads((directory/'plan.private.json').read_text())
    originals = json.loads((directory/'runtime-original.private.json').read_text())
    candidate = json.loads((directory/'runtime-candidate.private.json').read_text())
    if (plan.get('mode') != 'PREPARE_ONLY' or plan.get('application_source') != prep.SOURCE
            or plan.get('image') != CANDIDATE or plan.get('migration') != prep.MIGRATION
            or plan.get('migration_sha256') != prep.HASH or plan.get('previous_images') != prep.LIVE
            or plan.get('database_image') != prep.restore.IMAGE or plan.get('production_changed') is not False
            or plan.get('hatif_file_matches_live') is not True or set(originals) != set(prep.LIVE)
            or len(plan.get('rehearsal_fingerprints', {})) != 10):
        raise RuntimeError('Private plan does not match the reviewed approval release')
    # Validation also rejects malformed or identical UUIDs before any mutation.
    prep.preflight_sql(plan['manager_id'], plan['final_id'])
    for name, original in originals.items():
        if original['Image'] != prep.LIVE[name]:
            raise RuntimeError('Saved runtime image differs from the reviewed original')
    return plan, originals, candidate


def validate(directory):
    plan, originals, candidate = read_plan(directory)
    built = prep.inspect(CANDIDATE, image=True)
    if built['Id'] != CANDIDATE or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision') != prep.SOURCE:
        raise RuntimeError('Accepted image is missing or its source label differs')
    archive = Path(plan['backup'])
    if archive.resolve().parent != directory.resolve() or prep.digest(archive) != plan['backup_sha256']:
        raise RuntimeError('Rehearsed backup is missing, moved or changed')
    if prep.inspect('supabase-db')['Image'] != prep.restore.IMAGE:
        raise RuntimeError('Database image changed')
    content = (ROOT/'supabase/migrations'/prep.MIGRATION).read_text()
    sql = transaction(plan, content)
    for name, original in originals.items():
        current = prep.inspect(name)
        if (any(current[key] != original[key] for key in ('Id','Image','Config','HostConfig'))
                or current['NetworkSettings']['Networks'] != original['NetworkSettings']['Networks']
                or not current['State']['Running'] or current['State']['StartedAt'] != original['State']['StartedAt']):
            raise RuntimeError('Live runtime changed since approval preparation')
    refreshed = prep.candidate_runtime(originals['kohl_crm_app'], CANDIDATE, prep.HATIF_FILE)
    if refreshed != candidate:
        raise RuntimeError('Hatif or candidate runtime changed since preparation')
    payload(candidate, CANDIDATE, 'validation')
    return plan, originals, candidate, sql


def unchanged_frontends(originals):
    for name in ('kohl_broker_frontend', 'kohl_account_frontend'):
        saved = originals[name]
        current = prep.inspect(name)
        if any(current[key] != saved[key] for key in ('Id','Image','Config','HostConfig')) or not current['State']['Running']:
            raise RuntimeError('Preserved frontend changed')


def parked(original):
    result = copy.deepcopy(original['HostConfig'])
    result['RestartPolicy'] = {'Name':'no','MaximumRetryCount':0}
    return result


def rollback(original, release, log):
    saved = prep.inspect(original['Id'])
    if saved['Image'] != original['Image'] or saved['Config'] != original['Config'] or saved['HostConfig'] not in (original['HostConfig'], parked(original)):
        raise RuntimeError('Original container changed; manual recovery review required')
    # A rotated persistent secret must never be replaced by the old snapshot.
    prep.candidate_runtime(original, CANDIDATE, prep.HATIF_FILE)
    matches = api('GET', '/containers/json?all=true&filters='+urllib.parse.quote(json.dumps({'name':['^/kohl_crm_app$']})))
    if matches:
        if len(matches) != 1:
            raise RuntimeError('Ambiguous main container lookup')
        current = prep.inspect(matches[0]['Id'])
        if current['Id'] != original['Id']:
            if current['Image'] != CANDIDATE or (current['Config'].get('Labels') or {}).get('kohl.operations.release') != release:
                raise RuntimeError('Recovery blocked by an unrelated main container')
            api('DELETE', '/containers/'+current['Id']+'?force=true')
    saved = prep.inspect(original['Id'])
    if saved['Name'] != '/kohl_crm_app':
        api('POST', '/containers/'+original['Id']+'/rename?name=kohl_crm_app')
    if saved['HostConfig'] != original['HostConfig']:
        api('POST', '/containers/'+original['Id']+'/update', {'RestartPolicy':original['HostConfig']['RestartPolicy']})
    if not prep.inspect(original['Id'])['State']['Running']:
        api('POST', '/containers/'+original['Id']+'/start')
    health(original['Id'])
    nginx(['-t'], log)
    nginx(['-s','reload'], log)
    public_health()


def cutover(originals, candidate, folder, log):
    original = originals['kohl_crm_app']
    release = folder.parent.name+'-'+folder.name
    previous = 'kohl_crm_app_before_approval_'+release
    config, primary, endpoints = payload(candidate, CANDIDATE, release)
    journal = {'release':release,'phase':'before-stop','original_id':original['Id'],
               'previous_name':previous,'candidate_image':CANDIDATE,
               'database_rollback':'Keep approval chain and all data; old UI labels may not describe the two stages'}
    write_private(folder/'cutover.private.json', journal)
    # Last Hatif check before the first main-container mutation.
    if prep.candidate_runtime(original, CANDIDATE, prep.HATIF_FILE) != candidate:
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
        actual = prep.inspect(created['Id'])
        if (actual['Image'] != CANDIDATE or env(actual['Config']) != env(candidate['Config'])
                or actual['HostConfig'] != candidate['HostConfig']
                or set(actual['NetworkSettings']['Networks']) != set(endpoints)):
            raise RuntimeError('New container runtime mismatch')
        for network, endpoint in endpoints.items():
            if not set(endpoint['Aliases']).issubset(actual['NetworkSettings']['Networks'][network].get('Aliases') or []):
                raise RuntimeError('New container network aliases differ')
        health(created['Id'])
        nginx(['-t'], log); nginx(['-s','reload'], log)
        public_health(); unchanged_frontends(originals)
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
        raise RuntimeError('Original app restored; approval schema/data retained. Review finance UI before use.') from None


def fresh_backup(folder, log):
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
    print('RECOVERY OK: original app restored; approval chain and data retained.')
    print('The old finance UI does not describe both stages; review it before finance use.')


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
        print('APPROVAL DRY RUN OK: exact image, migration, reviewers, backup and Hatif validated.')
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
        receipt = {'migration':prep.MIGRATION,'sha256':prep.HASH,'state':'started-outcome-unknown'}
        write_private(folder/'migration.private.json', receipt)
        print('Fresh backup checked; applying the single reviewed approval migration.', flush=True)
        database(sql, log)
        receipt['state'] = 'committed'; write_private(folder/'migration.private.json', receipt)
        verify_applied(plan, log)
        validate(args.plan)
        cutover(originals, candidate, folder, log)
    print('APPROVAL RELEASE OK: main switched; Hatif preserved; broker/account unchanged.')
    print('Verify Mohammed manager review, Salem final approval and the private assistant in the UI.')


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
