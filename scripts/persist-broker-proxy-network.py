"""Persist only the proxy's already-attached broker network; do not restart the stack."""
import copy,os,pathlib,re,shutil,subprocess,yaml
os.umask(0o077)
path=pathlib.Path('/home/debian/n8n-docker/docker-compose.yml')
backup=pathlib.Path('/home/debian/backups/kohl-broker-frontend-20261108T231147Z')
text=path.read_text();before=yaml.safe_load(text)
assert before['services']['npm']['networks']==['n8n_net']
expected=copy.deepcopy(before);expected['services']['npm']['networks']=[*before['services']['npm']['networks'],'kohl_external_portal'];expected['networks']['kohl_external_portal']={'external':True}
match=re.search(r'(?ms)^  npm:[ \t]*\n.*?(?=^  [\w-]+:|^\S|\Z)',text);assert match
block=match.group();line=re.search(r'(?m)^( +)- n8n_net[ \t]*$',block);assert line
block=block[:line.end()]+ '\n'+line.group(1)+'- kohl_external_portal'+block[line.end():]
text=text[:match.start()]+block+text[match.end():]
match=re.search(r'(?ms)^networks:\s*\n.*?(?=^\S|\Z)',text);assert match
block=match.group().rstrip()+'\n  kohl_external_portal:\n    external: true\n\n'
text=text[:match.start()]+block+text[match.end():]
assert yaml.safe_load(text)==expected,'Unrelated Compose change detected'
shutil.copy2(path,backup/'proxy-compose-before.yml');path.write_text(text)
result=subprocess.run(['docker','compose','-f',str(path),'config','--quiet'],cwd=path.parent,capture_output=True)
if result.returncode:
 shutil.copy2(backup/'proxy-compose-before.yml',path);raise RuntimeError('Compose validation failed; restored original file')
print('Persisted only npm broker network; other stack configuration unchanged; no stack restart')
