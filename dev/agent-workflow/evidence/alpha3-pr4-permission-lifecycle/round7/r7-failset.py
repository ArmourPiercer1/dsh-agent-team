#!/usr/bin/env python3
"""ROUND-7 failset extractor (repaired method).

Usage: r7-failset.py <log> <failset-out> [baseline] [path-strip]
- FAIL lines only, dedup'd, path-normalized.
- Diff artifact prints BOTH sides' counts and only says BYTE-IDENTICAL when
  counts agree and content matches (the round-5 empty-diff failure mode is
  structurally impossible: counts are always printed, and an equality claim
  without matching counts is refused)."""
import re, sys, difflib

log, out = sys.argv[1], sys.argv[2]
base = sys.argv[3] if len(sys.argv) > 3 else None
strip = sys.argv[4] if len(sys.argv) > 4 else ''

def failset(lines):
    s = set()
    for ln in lines:
        ln = ln.replace('\r', '').rstrip('\n')
        m = re.match(r'^\s*FAIL\s+(.*)$', ln)
        if m:
            p = m.group(1)
            if strip and strip in p:
                p = p.replace(strip, '')
            s.add('FAIL ' + p.strip())
    return s

with open(log, encoding='utf-8', errors='replace') as f:
    new = failset(f.readlines())
tests = ''
with open(log, encoding='utf-8', errors='replace') as f:
    for ln in f:
        if re.match(r'^\s*Tests\s', ln.replace('\r', '')):
            tests = ln.replace('\r', '').strip()
with open(out, 'w') as f:
    f.write('\n'.join(sorted(new)) + '\n')
with open(out + '.meta', 'w') as f:
    f.write(f'failset-lines={len(new)}\ntests-line: {tests}\n')
print(f'{out}: {len(new)} lines | {tests}')
if base:
    with open(base, encoding='utf-8', errors='replace') as f:
        old = failset(f.readlines())
    diff = list(difflib.unified_diff(sorted(old), sorted(new), 'baseline', 'new', lineterm=''))
    d = out.rsplit('.', 1)[0] + '-diff.txt'
    with open(d, 'w') as f:
        f.write(f'baseline={base}\nbaseline-lines={len(old)}  new-lines={len(new)}\n')
        f.write('\n'.join(diff) if diff else '(no hunks)')
        f.write('\n')
        if old == new and len(old) == len(new):
            f.write('VERDICT: BYTE-IDENTICAL (failsets agree line-for-line)\n')
        else:
            f.write('VERDICT: DIFFERENT (see hunks above)\n')
    print(f'{d}: baseline={len(old)} new={len(new)} -> {"IDENTICAL" if old == new else "DIFFERENT"}')
