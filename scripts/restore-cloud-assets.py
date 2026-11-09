from pathlib import Path
import json,base64,hashlib
root=Path(__file__).resolve().parent.parent
for item in json.loads((root/'cloud-assets/manifest.json').read_text()):
 data=base64.b64decode(''.join((root/'cloud-assets'/p).read_text().strip() for p in item['parts']),validate=True)
 assert hashlib.sha256(data).hexdigest()==item['sha256'],item['path']
 (root/item['path']).write_bytes(data)
 print('Verified:',item['path'])
