"""Repair stale DB IPs in the isolated cutover preview only; retain old containers."""
import json, subprocess
from urllib.parse import urlparse
def inspect(name): return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
db=inspect('supabase-db')
address=db['NetworkSettings']['Networks']['supabase_default']['IPAddress']
for name,field,port in [('kohl-cutover-preview-auth','GOTRUE_DB_DATABASE_URL','39032'),('kohl-cutover-preview-rest','PGRST_DB_URI','39031')]:
    container=inspect(name)
    env=dict(x.split('=',1) for x in container['Config']['Env'] if '=' in x)
    uri=urlparse(env[field]); assert uri.path.lstrip('/').startswith('kohl_cutover_')
    env[field]=env[field].replace(uri.hostname,address)
    if field=='PGRST_DB_URI': env['PGRST_SERVER_PORT']=port
    subprocess.run(['docker','stop',name],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['docker','rename',name,name+'-password-backup'],check=True)
    command=['docker','run','-d','--name',name,'--network','host']
    for key,value in env.items(): command += ['-e',key+'='+value]
    command += [container['Config']['Image']]
    subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
    print(name+': isolated DB address repaired; original container retained')
