#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Check source identities, bounded mods, local imports and deployment closure."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
from build import ROOT, runtime_files, worker_source

def main():
    provenance = json.loads((ROOT / 'vendor/PROVENANCE.json').read_text())
    for entry in provenance['files']:
        data = (ROOT / entry['local']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['local'] + ': SHA-256 mismatch'
        if entry.get('gitBlob'):
            blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            assert blob == entry['gitBlob'], entry['local'] + ': upstream blob mismatch'
    names = runtime_files()
    for name in names:
        assert (ROOT / name).is_file(), name
        if name.endswith('.js'):
            text = (ROOT / name).read_text()
            assert 'SPDX-License-Identifier: Apache-2.0' in text, name
            subprocess.run(['node', '--check', str(ROOT / name)], check=True, capture_output=True)
            for target in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", text):
                assert target.startswith('.'), (name, target)
                resolved = (ROOT / name).parent.joinpath(target).resolve()
                assert str(resolved.relative_to(ROOT)) in names, (name, target)
    assert (ROOT / 'sw.js').read_text() == worker_source(names), 'Stale offline shell'
    assert not re.search(r'Math\.random|Date\.now|performance\.now|document\.|window\.', (ROOT / 'js/sim.js').read_text())
    for p in (ROOT / 'mods').glob('*.json'):
        assert p.stat().st_size <= 65536
        json.loads(p.read_text())
    print(f'PASS: provenance, JavaScript syntax, import closure, {len(names)} runtime files, offline identity')
if __name__ == '__main__':
    main()
