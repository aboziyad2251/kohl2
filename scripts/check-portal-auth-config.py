"""Read-only checks. Never print environment values or credentials."""
import json, subprocess
container = json.loads(subprocess.check_output(['docker','inspect','supabase-auth'], text=True))[0]
env = dict(item.split('=',1) for item in container['Config']['Env'])
print('default_jwt_secret=', env.get('GOTRUE_JWT_SECRET') == 'your-super-secret-jwt-token-with-at-least-32-characters-long')
print('smtp_configured=', bool(env.get('GOTRUE_SMTP_HOST')))
print('configured_smtp_container_present=', 'supabase-mail' in subprocess.check_output(['docker','ps','--format','{{.Names}}'], text=True).splitlines())
print('signup_disabled=', env.get('GOTRUE_DISABLE_SIGNUP') == 'true')
print('app_redirect_allowed=', 'https://app.kohlestate-ksa.online' in env.get('GOTRUE_URI_ALLOW_LIST',''))
print('auth_container_status=', container['State']['Status'])
print('auth_health=', container['State'].get('Health',{}).get('Status','not-reported'))
