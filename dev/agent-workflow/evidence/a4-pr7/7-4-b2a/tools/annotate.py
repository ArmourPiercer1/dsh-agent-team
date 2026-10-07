import sys, re
"""A4-PR7 §7.4 disposition comments. Usage: annotate.py <path> <comment-file>

Hangs the disposition comment above the declaration that opens the first
promoted document (the array literal or `lines.push(` carrying the envelope
pair), skipping an already-annotated file.
"""
path, cfile = sys.argv[1], sys.argv[2]
comment = open(cfile).read().rstrip('\n').split('\n')
lines = open(path).read().split('\n')
if any('A4-PR7 §7.4 (lane B-runtime-semantics-A)' in l for l in lines):
    print(f'{path}: already annotated'); raise SystemExit(0)
idx = next(i for i, l in enumerate(lines) if 'permissionMutationEnvelope:' in l)
j = idx
while j >= 0 and not re.search(r'=\s*\[|=\s*`|lines\.push\(|^\s*return \[|^\s*\[', lines[j]):
    j -= 1
assert j >= 0, f'{path}: no document opening found above the envelope pair'
ind = lines[j][:len(lines[j]) - len(lines[j].lstrip())]
lines[j:j] = [f'{ind}{c}' if c.strip() else '' for c in comment]
open(path, 'w').write('\n'.join(lines))
print(f'{path}: annotated at L{j + 1}')
