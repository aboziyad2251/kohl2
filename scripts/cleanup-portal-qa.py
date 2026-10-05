"""Remove only this release's disposable QA services/database; preserve PDFs."""
import json, os, pathlib, signal, subprocess
stage=pathlib.Path('/home/debian/projects/kohl-portals-release/.portal-stage')
pidfile=stage/'gateway.pid'
if pidfile.exists():
 pid=int(pidfile.read_text())
 try:
  cmd=pathlib.Path('/proc')/str(pid)/'cmdline'
  if str(stage/'gateway.py').encode() in cmd.read_bytes(): os.kill(pid,signal.SIGTERM)
 except FileNotFoundError: pass
for name in ['kohl-portals-test-app','kohl-portals-test-auth','kohl-portals-test-rest','kohl-portals-test-storage']:
 assert name.startswith('kohl-portals-test-')
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
database='kohl_cutover_portals_20261005'
assert database.startswith('kohl_cutover_portals_') and database!='postgres'
subprocess.run(['docker','exec','supabase-db','dropdb','-U','supabase_admin','--if-exists',database],check=True)
print('Disposable portal QA services and database removed; earlier previews and backups preserved')
