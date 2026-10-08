#!/usr/bin/env python3
"""Fixture-parse probe (a4-pr7/capability-negatives, task 5).

Answers the class question mechanically: for a given test file, does any of its
documents reach the VALIDATOR, or does the file's own YAML text die in the
product's YAML decoder first? A negative leg whose input never decodes cannot
have measured the validator, and if the leg is a bare `.toThrow()` it passes on
that syntax error.

How: temporarily instrument `decodeYamlFrontmatter`'s failure path to print one
line per refused document, tagged `[YAMLPROBE]`, with the caller frame from the
test file (so the event is attributable to a leg). One vitest process at a time;
the patched file is restored and the restore is sha256-verified.

Usage: python3 .../scratch/probe-fixtures.py packages/domain/test/bp1-blueprint-inspector.test.ts ...
"""
import hashlib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, *(['..'] * 6)))
EV = os.path.join(ROOT, 'dev', 'agent-workflow', 'evidence', 'a4-pr7', 'capability-negatives')
PARSE = os.path.join(ROOT, 'packages/domain/blueprint/src/parse.ts')

ENV = dict(os.environ, CI='true',
           XDG_CACHE_HOME='/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache')

OLD = """    if (err instanceof YAMLError) {
      const line = err.linePos?.[0]"""
NEW = """    if (err instanceof YAMLError) {
      const line = err.linePos?.[0]
      // YAMLPROBE (evidence harness, reverted): name the test-file frame that fed us this text.
      const frames = String(new Error().stack ?? '')
        .split('\\n')
        .filter((f) => /test[\\\\/][^\\\\/]+\\.(test|mts|ts):\\d+/.test(f) && !/node_modules/.test(f))
      console.warn(`[YAMLPROBE] decode-refused | ${frames.slice(0, 2).join(' || ')}`)"""


def read(p):
    with open(p, encoding='utf-8') as fh:
        return fh.read()


def write(p, t):
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(t)


def sha(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()


def main(targets):
    original = read(PARSE)
    before = sha(original)
    if original.count(OLD) != 1:
        raise SystemExit('probe site not unique in parse.ts')
    write(PARSE, original.replace(OLD, NEW))
    rows = []
    try:
        for target in targets:
            json_path = os.path.join(EV, 'raw', 'probe-' + os.path.basename(target) + '.json')
            transcript = os.path.join(EV, 'transcripts', 'probe-' + os.path.basename(target) + '.txt')
            with open(transcript, 'w') as out:
                subprocess.run(['pnpm', 'exec', 'vitest', 'run', target,
                                '--reporter=default', '--reporter=json', f'--outputFile.json={json_path}'],
                               cwd=ROOT, env=ENV, stdout=out, stderr=subprocess.STDOUT)
            hits = [ln for ln in read(transcript).split('\n') if '[YAMLPROBE]' in ln]
            red, green = [], []
            try:
                report = json.load(open(json_path, encoding='utf-8'))
                for suite in report.get('testResults', []):
                    for case in suite.get('assertionResults') or []:
                        name = (case.get('fullName') or ' '.join(
                            list(case.get('ancestorTitles') or []) + [case.get('title') or ''])).strip()
                        (red if case.get('status') == 'failed' else green).append(name)
            except Exception as exc:  # noqa: BLE001
                red.append(f'::UNPARSEABLE-REPORT:{exc}::')
            rows.append(dict(target=target, probe_hits=len(hits), hits=hits[:40],
                             red=sorted(red), green=sorted(green)))
            print(f'{target}: yaml-invalid-events={len(hits)} red={len(red)} green={len(green)}')
            for h in hits[:40]:
                print('    ', h.strip()[:200])
    finally:
        write(PARSE, original)
        restored = sha(read(PARSE)) == before
        print(f'\nparse.ts restored hash-verified={restored}')
        with open(os.path.join(EV, 'raw', 'probe-fixtures.json'), 'w', encoding='utf-8') as fh:
            json.dump(rows, fh, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:] or ['packages/domain/test/t1-capability-schema.test.ts'])
