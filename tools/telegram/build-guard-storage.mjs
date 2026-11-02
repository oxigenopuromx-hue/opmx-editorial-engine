import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,process.argv.includes('--h120')?'opmx-guard-telegram-events-h120.zip':process.argv.includes('--h118')?'opmx-guard-telegram-read-h118.zip':'opmx-guard-telegram-storage-h115.zip');
const files=['tools/mcp-publisher/guard-start.mjs','tools/mcp-publisher/guard-server.mjs','tools/mcp-publisher/direct-claim.mjs','tools/mcp-publisher/target-progress.mjs','tools/mcp-publisher/media-progress.mjs','tools/telegram/package-store.mjs','tools/telegram/intake.mjs','tools/telegram/event-store.mjs','tools/telegram/event-delivery.mjs'];
const pkg=JSON.parse(readFileSync(resolve(root,'tools/mcp-publisher/guard-package.json'),'utf8'));
pkg.scripts={start:'node server.js'};
const manifest={root,out,files,package:pkg};
mkdirSync('/tmp/opmx-telegram-storage-build',{recursive:true});
const manifestPath='/tmp/opmx-telegram-storage-build/manifest.json';
writeFileSync(manifestPath,JSON.stringify(manifest));
execFileSync('python',['-c',`import json,zipfile,sys,pathlib
m=json.loads(pathlib.Path(sys.argv[1]).read_text())
with zipfile.ZipFile(m['out'],'w',zipfile.ZIP_DEFLATED) as z:
 for p in m['files']: z.write(pathlib.Path(m['root'])/p,p)
 z.writestr('package.json',json.dumps(m['package']))
 z.writestr('server.js',"import './tools/mcp-publisher/guard-start.mjs';\\n")
print(json.dumps({'zip':m['out'],'files':len(m['files'])+2,'bytes':pathlib.Path(m['out']).stat().st_size}))`,manifestPath],{stdio:'inherit'});
