"""Read-only live profile/permission checks; no password changes or account creation."""
import json, subprocess, urllib.request, urllib.error
container=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
env=dict(x.split('=',1) for x in container['Config']['Env'] if '=' in x)
key=env['SUPABASE_SERVICE_ROLE_KEY']
def request(path,payload=None):
    req=urllib.request.Request('https://kohl.kohlestate-ksa.online'+path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=20) as response: return json.loads(response.read())
query="select json_agg(json_build_object('id',user_id,'role',role,'active',is_active)) from portal_private.accounts where role in ('ADMIN','CEO');"
profiles=json.loads(subprocess.check_output(['docker','exec','supabase-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-c',query]))
assert {x['role'] for x in profiles}=={'ADMIN','CEO'}
for profile in profiles:
    assert profile['active']
    identity=request('/auth/v1/admin/users/'+profile['id'])
    assert identity['id']==profile['id'] and identity.get('email_confirmed_at')
    result=request('/rest/v1/rpc/portal_admin',{'actor':profile['id'],'operation':'LIST','payload':{},'request_id':'00000000-0000-4000-8000-000000000001'})
    assert isinstance(result['users'],list)
    print(profile['role']+': confirmed Auth identity, active private profile and database user-management permission verified')
try: urllib.request.urlopen('https://app.kohlestate-ksa.online/api/access/users')
except urllib.error.HTTPError as error: assert error.code==401
else: raise AssertionError('Unauthenticated management must be denied')
assert container['Config']['Image']=='kohl-passwords:20261004'
print('Verified deployed password release; unauthenticated user management denied')
