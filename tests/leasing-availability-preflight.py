"""Verify operator diagnostics never expose runtime secrets or mutate containers."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('preflight', Path(__file__).parents[1] / 'scripts/preflight-leasing-availability.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
secret = 'synthetic-private-secret-not-for-output'
settings = {'HATIF_ENABLED': 'true', 'HATIF_WEBHOOK_SECRET': secret,
            'HATIF_CLIENT_ID': 'synthetic-client', 'HATIF_CLIENT_SECRET': 'synthetic-client-secret',
            'PASSWORD_RECOVERY_ENABLED': 'false'}
objects = [{'Name': '/' + name, 'Image': 'sha256:fixture', 'State': {'Running': True},
            'Config': {'Env': [k + '=' + v for k, v in settings.items()]}}
           for name in ('kohl_crm_app', 'kohl_broker_frontend', 'kohl_account_frontend')]
commands = []


def fake_run(args, text=None):
    commands.append((args, text))
    if args[:2] == ['docker', 'inspect']:
        return json.dumps(objects)
    assert args[:4] == ['docker', 'exec', '-i', 'supabase-db']
    assert text.startswith('BEGIN READ ONLY;') and text.endswith('ROLLBACK;')
    return json.dumps({'availability_migration_present': False, 'specialist_role_present': True,
                       'attachment_columns': []})


out = io.StringIO()
with patch.object(mod, 'run', fake_run), patch.object(Path, 'read_text', return_value='\n'.join(k + '=' + v for k, v in settings.items())), patch.object(mod.shutil, 'disk_usage', return_value=type('Usage', (), {'free': 10 * 1024**3})()), contextlib.redirect_stdout(out):
    mod.main()
assert len(commands) == 2
assert 'READ-ONLY PREFLIGHT COMPLETE' in out.getvalue()
for value in (secret, 'synthetic-client', 'synthetic-client-secret'):
    assert value not in out.getvalue()
print('PASS: preflight is read-only and withholds runtime secrets')
