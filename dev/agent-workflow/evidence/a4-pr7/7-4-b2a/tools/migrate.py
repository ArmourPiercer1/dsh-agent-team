import sys, re
"""A4-PR7 §7.4 migrate-by-hand. Usage: migrate.py <path> <from-version> [comment-file]

Every line carrying a quoted `schemaVersion: <from-version>` is a fixture
document: bump the digit to the supported version and declare the two envelopes
that version requires. Insertion keeps the array-element house form — each
element is its own quoted line and a nested line carries its two YAML spaces
INSIDE the quotes. A document whose metadata line also carries the closing
fence (the inline `lines.push(...)` / one-line-array shape) gets the elements
inserted before the metadata element instead, so nothing lands after the fence.
"""
path, frm = sys.argv[1], sys.argv[2]
comment = open(sys.argv[3]).read().rstrip('\n') if len(sys.argv) > 3 and sys.argv[3] != '-' else ''
lines = open(path).read().split('\n')
pat = re.compile(rf"'schemaVersion: {frm}'")
ENV = ["'permissionMutationEnvelope:',", "'  rules: []',", "'teamHardEnvelope:',", "'  rules: []',"]
out, i, docs = [], 0, 0
while i < len(lines):
    ln = lines[i]
    if pat.search(ln):
        if comment and docs == 0:
            k = len(out) - 1
            while k >= 0 and out[k].strip() == '':
                k -= 1
            if k >= 0 and out[k].strip().endswith('*/'):
                while k >= 0 and not out[k].strip().startswith('/**'):
                    k -= 1
                anchor = k if k >= 0 else len(out)
            else:
                j = k
                while j >= 0 and not re.match(r'^\s*(export\s+)?(const|function|let|var)\b', out[j]) and not out[j].strip().endswith('{'):
                    j -= 1
                anchor = j if j >= 0 else len(out)
            ind = out[anchor][:len(out[anchor]) - len(out[anchor].lstrip())] if anchor < len(out) else ''
            out += [f'{ind}{c}' if c.strip() else '' for c in comment.split('\n')]
        out.append(pat.sub("'schemaVersion: 3'", ln))
        docs += 1
        i += 1
        while i < len(lines):
            cur = lines[i]
            if 'metadata: {}' in cur:
                mi = cur[:len(cur) - len(cur.lstrip())]
                inline = "'---'" in cur or 'lines.push(' in cur
                if inline:
                    joined = ', '.join(e.rstrip(',') for e in ENV) + ", 'metadata: {}'"
                    out.append(cur.replace("'metadata: {}'", joined, 1))
                else:
                    out += [cur] + [f'{mi}{e}' for e in ENV]
                break
            out.append(cur)
            i += 1
    else:
        out.append(ln)
    i += 1
print(f'{path}: {docs} document(s)')
open(path, 'w').write('\n'.join(out))
