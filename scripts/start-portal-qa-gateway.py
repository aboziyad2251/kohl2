"""Keep the isolated, loopback QA proxy alive for browser verification."""
import ast, pathlib, subprocess, sys
stage=pathlib.Path('/home/debian/projects/kohl-portals-release')
source=(stage/'scripts/verify-portal-release.py').read_text()
tree=ast.parse(source)
node=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Gateway')
gateway='\n'.join(source.splitlines()[node.lineno-1:node.end_lineno])
path=stage/'.portal-stage/gateway.py'
path.write_text('import http.server,socketserver,urllib.request,urllib.error\n'+gateway+'\nsocketserver.ThreadingTCPServer.allow_reuse_address=True\nsocketserver.ThreadingTCPServer(("127.0.0.1",39053),Gateway).serve_forever()\n')
with (path.parent/'gateway.log').open('ab') as log:
 process=subprocess.Popen([sys.executable,str(path)],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
(path.parent/'gateway.pid').write_text(str(process.pid))
print('Loopback-only QA gateway started')
