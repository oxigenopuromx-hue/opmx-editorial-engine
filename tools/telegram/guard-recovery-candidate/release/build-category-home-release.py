#!/usr/bin/env python3
"""Assemble #13 over the exact #18 release without replacing unrelated files.

Only local files are read/written. No network, credentials, CMS or n8n calls.
The future writer manifest must have three new saved writer versions; it is
provided by prepare-category-home-stage.mjs finalize after graph comparison.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

MANIFEST = 'tools/telegram/guard-recovery-candidate/writer-release-manifest.mjs'
EXECUTOR = 'tools/telegram/guard-recovery-candidate/update-executor.mjs'
HELPER = 'tools/editorial/opuro-category-home.mjs'
CHANGED = {'4o7K5TmKc7joScqB', 'Mt7ts2EGPbyaTC2o', 'bnzVMNkZuGO1GQCZ'}
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
HEX = re.compile(r'^[a-f0-9]{64}$')
RUNTIME_PATCHED = [
    'tools/mcp-publisher/guard-server.mjs',
    'tools/telegram/guard-recovery-candidate/deployed-guard/guard-server.mjs',
    'tools/telegram/package-store.mjs',
    'tools/telegram/guard-recovery-candidate/package-store.mjs',
    'tools/telegram/guard-recovery-candidate/recovery-runtime-services.mjs',
    'tools/telegram/guard-recovery-candidate/recovery-wiring.mjs',
    'tools/telegram/guard-recovery-candidate/fence-preview-start.mjs',
]
RUNTIME_NEW = [HELPER,
    'tools/telegram/guard-recovery-candidate/editorial-placement-store.mjs',
    'tools/telegram/guard-recovery-candidate/editorial-placement-integration.mjs',
]

def expected_executor(source):
    def change(a, b):
        nonlocal source
        if source.count(a) != 1:
            raise ValueError('CATEGORY_HOME_EXECUTOR_BASE_REBASE_REQUIRED')
        source = source.replace(a, b)
    change("import {canonicalUpdateValue} from './canonical-json.mjs';\n", "import {canonicalUpdateValue} from './canonical-json.mjs';\nimport {checkOpuroCategoryUpdate,assertPreservedOpuroCategoryMeta} from '../../editorial/opuro-category-home.mjs';\n")
    change('claimStore,wordpress}){', 'claimStore,wordpress,verifyEditorialPlacement}){')
    change("typeof wordpress?.update!=='function')throw", "typeof wordpress?.update!=='function'||verifyEditorialPlacement!==undefined&&typeof verifyEditorialPlacement!=='function')throw")
    line = "  let claimed;try{claimed=await claimStore.begin("
    block = """  try{checkOpuroCategoryUpdate(destination,payload,before.post)}catch{return no('PAYLOAD_UNCONFIRMED',{postId})}
  // Production supplies the Guard-backed verifier for every destination, even
  // when the field is absent, so a stored operator order cannot be orphaned.
  // An unconfigured adapter preserves legacy unrelated updates only; it can
  // never authorise a newly declared placement change, including [].
  try{if(typeof verifyEditorialPlacement==='function'?await verifyEditorialPlacement({packageId,revision,destination,previewHash,payload})!==true:Object.hasOwn(payload.meta??{},'oxpuro_excluded_category_ids')||Object.hasOwn(d.finalPayloads?.OPURO?.meta??{},'oxpuro_excluded_category_ids'))return no('EDITORIAL_PLACEMENT_UNCONFIRMED',{postId})}catch{return no('EDITORIAL_PLACEMENT_UNCONFIRMED',{postId})}
"""
    change(line, block + line)
    line = "  if(typeof wordpress.recordConfirmation==='function'){"
    change(line, "  try{checkOpuroCategoryUpdate(destination,payload,after.post);assertPreservedOpuroCategoryMeta(destination,payload,before.post,after.post)}catch{return no('UPDATE_UNCERTAIN',{postId,writeAttempted:true})}\n" + line)
    return source

def expected_runtime_hashes(base, source):
    code = r"""
import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const [src,base]=process.argv.slice(1);const m=await import(pathToFileURL(join(src,'tools/telegram/guard-recovery-candidate/editorial-placement-integration.mjs')).href);
const specs=[['tools/mcp-publisher/guard-server.mjs',m.patchEditorialPlacementGuardSource],['tools/telegram/guard-recovery-candidate/deployed-guard/guard-server.mjs',m.patchEditorialPlacementGuardSource],['tools/telegram/package-store.mjs',m.patchEditorialPlacementPackageStoreSource],['tools/telegram/guard-recovery-candidate/package-store.mjs',m.patchEditorialPlacementPackageStoreSource],['tools/telegram/guard-recovery-candidate/recovery-runtime-services.mjs',m.patchEditorialPlacementRuntimeSource],['tools/telegram/guard-recovery-candidate/recovery-wiring.mjs',m.patchEditorialPlacementWiringSource],['tools/telegram/guard-recovery-candidate/fence-preview-start.mjs',m.patchEditorialPlacementStartupSource]];
const result={};for(const [path,fn]of specs)result[path]=createHash('sha256').update(fn(await readFile(join(base,path),'utf8'))).digest('hex');process.stdout.write(JSON.stringify(result));
"""
    result = subprocess.run(['node', '--input-type=module', '-e', code, str(source.resolve()), str(base.resolve())], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def read_manifest(path):
    text = path.read_text()
    if text.count('export default ') != 1:
        raise ValueError('CATEGORY_HOME_MANIFEST_FORMAT')
    return json.loads(text.split('export default ', 1)[1].strip().removesuffix(';'))

def hashes(directory):
    result = {}
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError('CATEGORY_HOME_RELEASE_SYMLINK')
        if path.is_file():
            result[path.relative_to(directory).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

def build_release(base, source, manifest_path, release_dir, archive):
    base, source, manifest_path, release_dir, archive = map(Path, (base, source, manifest_path, release_dir, archive))
    if release_dir.exists() or archive.exists():
        raise ValueError('CATEGORY_HOME_OUTPUT_ALREADY_EXISTS')
    previous, future = read_manifest(base / MANIFEST), read_manifest(manifest_path)
    if previous.get('schema') != 'opmx.fenced-writer-release.v1' or future.get('schema') != previous['schema'] or set(future.get('workflows', {})) != set(previous.get('workflows', {})):
        raise ValueError('CATEGORY_HOME_MANIFEST_SCOPE')
    for identifier, old in previous['workflows'].items():
        new = future['workflows'][identifier]
        if not UUID.fullmatch(new.get('versionId', '')) or not HEX.fullmatch(new.get('graphHash', '')):
            raise ValueError('CATEGORY_HOME_MANIFEST_PIN')
        if identifier in CHANGED:
            if new['versionId'] == old['versionId'] or new['graphHash'] == old['graphHash']:
                raise ValueError('CATEGORY_HOME_WRITER_NOT_STAGED')
        elif new != old:
            raise ValueError('CATEGORY_HOME_UNRELATED_WRITER_CHANGED')
    if (source / EXECUTOR).read_text() != expected_executor((base / EXECUTOR).read_text()):
        raise ValueError('CATEGORY_HOME_EXECUTOR_BASE_REBASE_REQUIRED')
    expected_patches = expected_runtime_hashes(base, source)
    for relative, expected_hash in expected_patches.items():
        if hashlib.sha256((source / relative).read_bytes()).hexdigest() != expected_hash:
            raise ValueError('CATEGORY_HOME_RUNTIME_BASE_REBASE_REQUIRED:' + relative)
    before = hashes(base)
    if any(relative in before for relative in RUNTIME_NEW):
        raise ValueError('CATEGORY_HOME_AUTHORITY_ALREADY_INSTALLED')
    shutil.copytree(base, release_dir)
    for relative in RUNTIME_NEW + RUNTIME_PATCHED + [EXECUTOR]:
        (release_dir / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / relative, release_dir / relative)
    shutil.copyfile(manifest_path, release_dir / MANIFEST)
    after = hashes(release_dir)
    delta = sorted(path for path in set(before) | set(after) if before.get(path) != after.get(path))
    if delta != sorted(RUNTIME_NEW + RUNTIME_PATCHED + [EXECUTOR, MANIFEST]):
        raise ValueError('CATEGORY_HOME_UNEXPECTED_RUNTIME_DELTA')
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for relative in sorted(after):
            entry = zipfile.ZipInfo(relative, date_time=(2026, 11, 13, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, (release_dir / relative).read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    result = {'status': 'CATEGORY_HOME_RELEASE13_ASSEMBLED_NOT_DEPLOYED', 'archive': archive.name,
              'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size,
              'files': len(after), 'baseFiles': len(before), 'runtimeDelta': delta,
              'unchangedBaseFiles': len(before) - len(RUNTIME_PATCHED) - 2, 'workflows': future['workflows'],
              'cmsWrites': 0, 'n8nMutations': 0}
    archive.with_suffix('.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for option in ['base', 'source', 'manifest', 'release-dir', 'archive']:
        parser.add_argument('--' + option, required=True)
    args = parser.parse_args()
    print(json.dumps(build_release(args.base, args.source, args.manifest, args.release_dir, args.archive), ensure_ascii=False, indent=2))
