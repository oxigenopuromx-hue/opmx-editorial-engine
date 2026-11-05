#!/usr/bin/env python3
"""Create a deterministic guard runtime package; no secrets or dependencies."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parent
output = Path(sys.argv[1]) if len(sys.argv) == 2 else Path('opmx-guard-integrated-v3.zip')
source = ['guard-start.mjs', 'guard-server.mjs', 'direct-claim.mjs', 'target-progress.mjs', 'media-progress.mjs']
files = [('tools/mcp-publisher/' + name, (root / name).read_bytes()) for name in source]
telegram = ['event-delivery.mjs', 'event-store.mjs', 'intake.mjs', 'package-store.mjs', 'review-store.mjs']
files += [('tools/telegram/' + name, (root.parent / 'telegram' / name).read_bytes()) for name in telegram]
files += [('package.json', (root / 'guard-package.json').read_bytes()), ('server.js', b"import './tools/mcp-publisher/guard-start.mjs';\n")]
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in files:
        entry = ZipInfo(name, (2026, 11, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, content)
with ZipFile(output) as archive:
    if archive.testzip() is not None or archive.namelist() != [name for name, _ in files]:
        raise RuntimeError('Paquete inválido')
print(f'{output}: {sha256(output.read_bytes()).hexdigest()}')

