#!/usr/bin/env python3
"""Mutation / reachability harness for the a4-pr7 capability-negatives lane.

For each mutant: take an in-memory copy + sha256 of the file it patches, apply
an EXACT single-site patch, run the target test file once (one vitest process at
a time), record which legs went red, restore the file from the copy and VERIFY
the restore by sha256. A mutant that turns nothing red is reported as
SUSPECT-DEAD, never as a pass.

Usage: python3 dev/agent-workflow/evidence/a4-pr7/capability-negatives/scratch/mutate.py [M1 M4]
"""
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, *(['..'] * 6)))
EV = os.path.join(ROOT, 'dev', 'agent-workflow', 'evidence', 'a4-pr7', 'capability-negatives')
VALIDATE = os.path.join(ROOT, 'packages/domain/blueprint/src/validate.ts')
TESTFILE = os.path.join(ROOT, 'packages/domain/test/t1-capability-schema.test.ts')
TARGET = 'packages/domain/test/t1-capability-schema.test.ts'

ENV = dict(os.environ, CI='true',
           XDG_CACHE_HOME='/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache')


def read(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def run_vitest(label):
    json_path = os.path.join(EV, 'raw', f'mut-{label}.json')
    transcript = os.path.join(EV, 'transcripts', f'mut-{label}.txt')
    with open(transcript, 'w') as out:
        subprocess.run(['pnpm', 'exec', 'vitest', 'run', TARGET,
                        '--reporter=default', '--reporter=json', f'--outputFile.json={json_path}'],
                       cwd=ROOT, env=ENV, stdout=out, stderr=subprocess.STDOUT)
    red, passed = [], []
    try:
        with open(json_path, encoding='utf-8') as fh:
            report = json.load(fh)
        for suite in report.get('testResults', []):
            assertions = suite.get('assertionResults') or []
            for case in assertions:
                name = (case.get('fullName')
                        or ' '.join(list(case.get('ancestorTitles') or []) + [case.get('title') or ''])).strip()
                (red if case.get('status') == 'failed' else passed).append(name)
            if suite.get('status') == 'failed' and not assertions:
                red.append('FILE::COLLECTION-OR-UNHANDLED')
    except Exception as exc:  # noqa: BLE001
        red.append(f'::UNPARSEABLE-REPORT:{exc}::')
    return sorted(red), sorted(passed)


MUTANTS = [
    dict(id='M1', file=VALIDATE, expect_red=['4.', '4b.', '5.'],
         why='neuter validateAllowDenyEntry: no closed-vocabulary refusal at all, value projection kept',
         old="""function validateAllowDenyEntry(raw: unknown, path: string): DenyEntry | { kind: 'allow'; items: readonly string[] } {
  const record = assertPlainRecord(raw, `${path} (allow/deny entry)`)""",
         new="""function validateAllowDenyEntry(raw: unknown, path: string): DenyEntry | { kind: 'allow'; items: readonly string[] } {
  // MUTANT M1 (evidence harness, reverted): the closed-vocabulary branch is gone.
  if (raw !== null && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (r['kind'] === 'deny') return { kind: 'deny' }
    const items = Array.isArray(r['items']) ? (r['items'] as string[]) : []
    return { kind: 'allow', items }
  }
  const record = assertPlainRecord(raw, `${path} (allow/deny entry)`)"""),
    dict(id='M2', file=VALIDATE, expect_red=['6a.'],
         why='neuter the capabilities closed field set (assertNoUnknownFields over BLUEPRINT_CAPABILITIES_FIELDS)',
         old="  assertNoUnknownFields(record, BLUEPRINT_CAPABILITIES_FIELDS, `${path} (capabilities)`)",
         new="  // MUTANT M2 (evidence harness, reverted): capabilities field set left open.\n  void BLUEPRINT_CAPABILITIES_FIELDS"),
    dict(id='M3', file=VALIDATE, expect_red=['6b.'],
         why='neuter the TEMPLATE closed field set (assertNoUnknownFields over templateFields)',
         old="  assertNoUnknownFields(record, templateFields, `${path} (template)`)",
         new="  // MUTANT M3 (evidence harness, reverted): template field set left open.\n  void templateFields"),
    # 0b is deliberately NOT in the expectation: its `tricky` fixture is array-free, so an
    # array-emission regression cannot reach it. Legs 5 / 6a are the same case: their fixtures
    # use only EMPTY arrays, which the base emitter emitted correctly.
    dict(id='M4', file=TESTFILE, expect_red=['0a.', '2.', '3.', '4.', '4b.', '6b.', '7.', '8.', '9.', '11.'],
         why='re-introduce the BASE emitter defect: a non-empty array emitted inline after its key',
         old="""      if (Array.isArray(entryValue)) {
        if (entryValue.length === 0) return `${pad}${key}: []`
        return `${pad}${key}:\\n${toYamlFrontmatter(entryValue, indent + 1)}`
      }""",
         new="""      if (Array.isArray(entryValue)) {
        if (entryValue.length === 0) return `${pad}${key}: []`
        return `${pad}${key}: ${toYamlFrontmatter(entryValue, indent + 1)}`
      }"""),
    dict(id='M5', file=VALIDATE, expect_red=['7.'],
         why='drop capabilities from the hashable projection (the regression BASELINE-CLASSES row 4 says the suite cannot see today)',
         old="""    capabilities:
      template.capabilities === undefined ? null : toHashableCapabilities(template.capabilities),""",
         new="""    // MUTANT M5 (evidence harness, reverted): capabilities leave the hashable projection.
    capabilities: null,"""),
]


def main():
    only = set(sys.argv[1:])
    rows = []
    for mut in MUTANTS:
        if only and mut['id'] not in only:
            continue
        path = mut['file']
        original = read(path)
        before = sha256(original)
        if mut['old'] not in mut['new'] and original.count(mut['old']) != 1:
            raise SystemExit(f"patch site not unique ({original.count(mut['old'])}) for {mut['id']}")
        write(path, original.replace(mut['old'], mut['new']))
        red, passed = run_vitest(mut['id'])
        write(path, original)
        after = sha256(read(path))
        restored = after == before
        def went_red(prefix):
            return any(r.replace('T1: Blueprint Capability Schema ', '').startswith(prefix) for r in red)

        hit = [p for p in mut['expect_red'] if went_red(p)]
        missed = [p for p in mut['expect_red'] if p not in hit]
        status = 'ALIVE' if red else 'SUSPECT-DEAD'
        rows.append(dict(id=mut['id'], why=mut['why'], expect=mut['expect_red'], red=red,
                         green=passed, restored=restored, sha=before, status=status, missed=missed))
        print(f"{mut['id']} [{status}] restored-hash-verified={restored} red={len(red)} green={len(passed)} "
              f"expected-red={mut['expect_red']} not-turned-red={missed}")
        for r in red:
            print(f'    RED  {r}')
        print()

    with open(os.path.join(EV, 'raw', 'mutation-table.json'), 'w', encoding='utf-8') as fh:
        json.dump(rows, fh, indent=1)


if __name__ == '__main__':
    main()
