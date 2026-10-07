#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A4-PR7 Ruling 1 — failing-IDENTITY diff, base vs post.

Counts are not evidence: 23 failing tests at base and 20 after a change can be two
disjoint sets. This reduces each vitest run's own output to the same two identity
kinds `scripts/fail-set.mjs` uses (`TEST <path>::<full name>` and
`FILE <path>::COLLECTION-OR-UNHANDLED`), and diffs the sets — because "same debt as
before" is only true set-wise.

Usage: identity-diff.py <base-run…> — <post-run…>
"""
import re
import sys

TEST_FAIL = re.compile(r'\s*FAIL\s+(\S+?\.test\.ts)\s+>\s+(.*)$')
FILE_FAIL = re.compile(r'\s*FAIL\s+(\S+?\.test\.ts)\s+\[')


def identities(path):
    found = set()
    for line in open(path, encoding='utf-8', errors='replace'):
        file_match = FILE_FAIL.match(line)
        if file_match:
            found.add(f'FILE {file_match.group(1)}::COLLECTION-OR-UNHANDLED')
            continue
        test_match = TEST_FAIL.match(line)
        if test_match:
            name = re.sub(r'\s+', ' ', test_match.group(2)).strip()
            found.add(f'TEST {test_match.group(1)}::{name}')
    return found


def report(label, runs):
    per_run = [(path, identities(path)) for path in runs]
    union = set().union(*(ids for _, ids in per_run)) if per_run else set()
    print(f'--- {label}: {len(per_run)} run(s), union {len(union)} identities')
    for path, ids in per_run:
        print(f'      {path}: {len(ids)}')
    return union


sep = sys.argv.index('--')
base = report('BASE', sys.argv[1:sep])
post = report('POST', sys.argv[sep + 1:])
print()
print(f'NEW (in POST, never in BASE) — must be empty for "no new failing identity": {len(post - base)}')
for identity in sorted(post - base):
    print(f'  + {identity[:200]}')
print(f'RESOLVED (in BASE, absent from POST): {len(base - post)}')
for identity in sorted(base - post):
    print(f'  - {identity[:200]}')
print()
print('Note on the BASE union: a base run flaps on `p6t1-parallel` (the declared flake of')
print('this lane), so the base UNION is wider than either base run. The comparison that')
print('matters is NEW, and it is computed against the union for that reason.')
