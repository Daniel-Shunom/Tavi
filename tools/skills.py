"""Verify vendored agent skills; restore missing files from pinned GitHub revisions.
Python 3.10+, standard library only. Never executes downloaded skill content.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', action='store_true', help='Download missing files only; changed files are never overwritten')
    parser.add_argument('--destination', type=Path, default=ROOT, help='Alternate checkout root for restoration testing')
    args = parser.parse_args()
    destination = args.destination.resolve()
    lock = json.loads((ROOT / '.agents/skills.lock.json').read_text(encoding='utf-8'))
    records = []
    for skill in lock['skills']:
        for name, expected in skill['files'].items():
            records.append((skill['repository'], skill['commit'], skill['path'] + '/' + name,
                            '.agents/skills/' + skill['name'] + '/' + name, expected))
    for notice in lock['notices']:
        records.append((notice['repository'], notice['commit'], notice['path'], notice['destination'], notice['sha256']))
    archives = {}
    failures = []
    for repo, commit, source, relative, expected in records:
        target = (destination / relative).resolve()
        if not target.is_relative_to(destination):
            raise ValueError('Lockfile contains an unsafe destination')
        if target.is_file():
            if digest(target.read_bytes()) != expected:
                failures.append(relative + ': modified; preserve your edit or restore it explicitly with Git')
            continue
        if not args.restore:
            failures.append(relative + ': missing (run python tools/skills.py --restore)')
            continue
        key = (repo, commit)
        if key not in archives:
            request = urllib.request.Request('https://codeload.github.com/' + repo + '/zip/' + commit,
                                             headers={'User-Agent': 'Tavi-skills-restore'})
            with urllib.request.urlopen(request, timeout=60) as response:
                archives[key] = zipfile.ZipFile(io.BytesIO(response.read()))
        archive = archives[key]
        prefix = archive.namelist()[0].split('/')[0] + '/'
        data = archive.read(prefix + source)
        if digest(data) != expected:
            raise ValueError('Downloaded content does not match pinned hash: ' + relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        return 1
    print(f"Verified {len(lock['skills'])} skills and {len(records)} pinned files.")
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print('Skill verification failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
