#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A4-PR7 Ruling 1 — mutation proofs.

Each mutation flips PRODUCTION ONLY (never a test), runs the ruling's lane, and is
reverted from the committed tree. A mutation that nothing catches would mean the
test file asserts a shape production does not have to provide — so the point of
this driver is the RED, not the green.

Usage: mutate.py <id> — prints the receipt body for that mutation.
"""
import subprocess
import sys

WT = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7b'
LANE = [
    'packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts',
    'packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts',
]
BA = 'packages/runtime/src/plugin/blueprint-authority.ts'
ROOT = 'packages/runtime/src/plugin/root.ts'
S6 = 'packages/runtime/src/plugin/s6-remote.ts'
HOST = 'packages/runtime/src/plugin/host.ts'

MUTATIONS = {
    # The collapse the ruling exists to forbid, done in the classifier itself.
    'M1-collapse-unreadable-to-current': (BA, "  return 'unreadable'", "  return 'current'"),
    # The collapse the brief names by hand.
    'M2-collapse-unreadable-to-migration-required': (BA, "  return 'unreadable'", "  return 'migration-required'"),
    # The wiring, not the field: root stops supplying the reader.
    'M3-unwire-the-root-reader': (ROOT, '    catalogMigrationStates,\n', ''),
    # The wire field disappears while the domain value stays correct.
    'M4-drop-the-payload-field': (S6, 'rows.push({ blueprintId, revisions, revisionStates })',
                                  'rows.push({ blueprintId, revisions })'),
    # The human-facing line stops distinguishing the two refusals (arm 1).
    'M5-render-collapses-arm-1': (HOST, 'and is LISTED in the catalog with migrationState=migration-required',
                                  'and is LISTED in the catalog with migrationState=unreadable'),
    # …and arm 2.
    'M6-render-collapses-arm-2': (HOST,
                                  '`anchor identity could not be read (migrationState=unreadable), so it is not listed — `',
                                  '`anchor identity could not be read (migrationState=migration-required), so it is listed — `'),
    # The deleted boolean, put back by hand: proves the pin is the TEST, not only tsc.
    'M7-boolean-comes-back': (BA, "        migrationState: inspection.status === 'ok' ? 'current' : 'migration-required',",
                              "        migrationState: inspection.status === 'ok' ? 'current' : 'migration-required',\n        migrationRequired: false,"),
}


def run(argv):
    return subprocess.run(argv, cwd=WT, capture_output=True, text=True).stdout


mid = sys.argv[1]
path, old, new = MUTATIONS[mid]
text = open(f'{WT}/{path}', encoding='utf-8').read()
count = text.count(old)
if count != 1:
    sys.exit(f'{mid}: anchor found {count} times in {path}, refusing to mutate')
open(f'{WT}/{path}', 'w', encoding='utf-8').write(text.replace(old, new))

print(f'=== MUTATION {mid} ===')
print(f'=== production file flipped (test files untouched): {path}')
print(f'===   - {old.strip() or "(line deleted)"}')
print(f'===   + {new.strip() or "(line deleted)"}')
print('=== git diff --stat (what the mutation touched):')
print(run(['git', 'diff', '--stat']).rstrip())
print(f'########## pnpm exec vitest run {" ".join(LANE)} ##########')
proc = subprocess.run(['pnpm', 'exec', 'vitest', 'run', *LANE], cwd=WT, capture_output=True, text=True)
print(proc.stdout, end='')
print(proc.stderr, end='')
print(f'[mutation vitest exit={proc.returncode}]')
print('=== reverting from the committed tree:')
subprocess.run(['git', 'checkout', '--', path], cwd=WT, check=True)
rest = run(['git', 'status', '--porcelain']).strip()
print('=== git status --porcelain after revert (must show no M for the mutated file):')
print(rest if rest else '(clean)')
