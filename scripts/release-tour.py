"""Employee-tour application-only cutover. Default: read-only production checks, no deployment.

Use only the tested private tour plan. --apply requires the approved
exact image. Recovery restores the original app, retaining all identities and data.
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
CANDIDATE = 'sha256:bdc7734c1dacfa8cc32a71de0c272da46f2576504d0e768c36d1cf8ca1a6317a'


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tour = load('tour_preparation', 'prepare-tour-release.py')
prep = tour.build
prep.LIVE = tour.LIVE
# Import inert definitions only. Never invoke the historical execute/main,
# validate, cutover, or rollback paths with their old images/migrations.
shared = load('operations_release_helpers', 'release-operations.py')
api = shared.api
write_private = shared.write_private
nginx = shared.nginx
health = shared.health
public_health = shared.public_health
payload = shared.payload
env = shared.env
release_lock = shared.release_lock


def candidate_health(container):
    health(container)
    code="fetch('http://127.0.0.1:3000/api/auth/leasing-switch',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"
    subprocess.run(['docker','exec',container,'node','-e',code],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)


def public_leasing_health():
    public_health()
    with urllib.request.urlopen('https://app.kohlestate-ksa.online/api/auth/providers',timeout=12) as response:
        if json.load(response).get('recovery') is not False:raise RuntimeError('Public recovery was re-enabled')
    try:
        with urllib.request.urlopen('https://app.kohlestate-ksa.online/api/auth/leasing-switch',timeout=12) as response:status=response.status
    except urllib.error.HTTPError as error:status=error.code
    if status!=401:raise RuntimeError('Public leasing route check failed')


def read_plan(directory):
    plan=json.loads((directory/'plan.private.json').read_text())
    originals=json.loads((directory/'runtime-original.private.json').read_text())
    candidate=json.loads((directory/'runtime-candidate.private.json').read_text())
    if (plan.get('source')!=tour.SOURCE or plan.get('image')!=CANDIDATE or plan.get('previous_images')!=tour.LIVE
        or plan.get('migrations')!=[] or plan.get('production_changed') is not False
        or plan.get('account_recovery_disabled') is not True or plan.get('hatif_matches_live') is not True
        or set(originals)!=set(tour.LIVE)):
        raise RuntimeError('Private plan does not match the reviewed tour release')
    receipt_path=directory/'http-receipt.private.json'
    if prep.digest(receipt_path)!=plan.get('http_receipt_sha256'):
        raise RuntimeError('HTTP acceptance receipt changed')
    receipt=json.loads(receipt_path.read_text())
    if (receipt.get('image')!=CANDIDATE or receipt.get('passed') is not True or receipt.get('production_changed') is not False
        or receipt.get('test_script_sha256')!=prep.digest(ROOT/'scripts/test-leasing-switch.py')):
        raise RuntimeError('HTTP acceptance does not cover this candidate')
    for name,original in originals.items():
        if original['Image']!=tour.LIVE[name]:raise RuntimeError('Saved runtime image differs')
    if prep.env(originals['kohl_account_frontend']).get('PASSWORD_RECOVERY_ENABLED')!='false':
        raise RuntimeError('Recovery must remain disabled')
    return plan,originals,candidate


def validate(directory):
    plan,originals,candidate=read_plan(directory)
    built=prep.inspect(CANDIDATE,image=True)
    if built['Id']!=CANDIDATE or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision')!=tour.SOURCE:
        raise RuntimeError('Accepted image or source differs')
    for name,original in originals.items():
        current=prep.inspect(name)
        if (any(current[key]!=original[key] for key in ('Id','Image','Config','HostConfig'))
            or current['NetworkSettings']['Networks']!=original['NetworkSettings']['Networks']
            or not current['State']['Running'] or current['State']['StartedAt']!=original['State']['StartedAt']):
            raise RuntimeError('Live runtime changed since preparation')
    if prep.candidate_runtime(originals['kohl_crm_app'],CANDIDATE)!=candidate:
        raise RuntimeError('Hatif or candidate runtime changed since preparation')
    payload(candidate,CANDIDATE,'validation')
    return plan,originals,candidate


def unchanged_frontends(originals):
    for name in ('kohl_broker_frontend', 'kohl_account_frontend'):
        saved = originals[name]
        current = prep.inspect(name)
        if (any(current[key] != saved[key] for key in ('Id','Image','Config','HostConfig','NetworkSettings'))
                or not current['State']['Running'] or current['State']['StartedAt']!=saved['State']['StartedAt']):
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
    prep.candidate_runtime(original, CANDIDATE)
    matches = api('GET', '/containers/json?all=true&filters='+urllib.parse.quote(json.dumps({'name':['^/kohl_crm_app$']})))
    remove_id=None
    if matches:
        if len(matches) != 1:
            raise RuntimeError('Ambiguous main container lookup')
        current = prep.inspect(matches[0]['Id'])
        if current['Id'] != original['Id']:
            if current['Image'] != CANDIDATE or (current['Config'].get('Labels') or {}).get('kohl.operations.release') != release:
                raise RuntimeError('Recovery blocked by an unrelated main container')
            remove_id=current['Id']
    if remove_id is not None:api('DELETE','/containers/'+remove_id+'?force=true')
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
    previous = 'kohl_crm_app_before_tour_'+release
    config, primary, endpoints = payload(candidate, CANDIDATE, release)
    journal = {'release':release,'phase':'before-stop','original_id':original['Id'],
               'previous_name':previous,'candidate_image':CANDIDATE,
               'database_rollback':'No database changes; existing identities and records retained'}
    write_private(folder/'cutover.private.json', journal)
    # Last Hatif check before the first main-container mutation.
    if prep.candidate_runtime(original, CANDIDATE) != candidate:
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
        candidate_health(created['Id'])
        nginx(['-t'], log); nginx(['-s','reload'], log)
        public_leasing_health(); unchanged_frontends(originals)
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
        raise RuntimeError('Original app restored; all identities and data unchanged.') from None


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
    print('RECOVERY OK: original app restored; all identities and data unchanged.')


def execute(args):
    if args.rollback:
        recover(args.plan, args.rollback, args.approved_image)
        return
    if args.apply and args.approved_image != CANDIDATE:
        raise RuntimeError('Apply requires the approved exact candidate image')
    if (args.plan/'apply-started.private.json').exists():
        raise RuntimeError('This plan was already attempted; inspect receipts before any retry')
    plan, originals, candidate = validate(args.plan)
    with open(os.devnull,'wb') as quiet:
        nginx(['-t'],quiet)
    if not args.apply:
        print('TOUR DRY RUN OK: exact image, acceptance receipt, runtime and Hatif validated; recovery remains disabled.')
        print('No deployment or database changes performed.')
        return
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder=args.plan/('release-'+stamp);folder.mkdir(mode=0o700)
    write_private(args.plan/'apply-started.private.json',{'directory':str(folder.resolve()),'image':CANDIDATE})
    print('Private release directory: '+str(folder),flush=True)
    with (folder/'private.log').open('xb') as log:
        validate(args.plan)
        cutover(originals,candidate,folder,log)
    print('TOUR RELEASE OK: main switched; Hatif preserved; recovery disabled; broker/account unchanged.')
    print('No database changes. Sign in and verify the tour, Skip and replay button.')


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
