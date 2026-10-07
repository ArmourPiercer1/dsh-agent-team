import sys, re
"""A4-PR7 §7.4 self-owned witness. Usage: witness.py <path> <comment-file> <from-version>

Keeps the document's bytes, moves the digit: the quoted literal carrying
`schemaVersion: <from-version>` becomes a template literal interpolating a
module-level constant that the file owns and types as TeamBlueprint['schemaVersion'],
so the fence sees no version site and §7.3's narrowing of that type turns the
constant's assignment into a compile error naming this file. The constant block
goes above the top-level declaration that opens the document.
"""
path, cfile, frm = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().split('\n')
pat = re.compile(rf"^\s*'schemaVersion: {frm}',\s*$")
idx = next(i for i, l in enumerate(lines) if pat.match(l))
ind = lines[idx][:len(lines[idx]) - len(lines[idx].lstrip())]
j = idx
while j > 0 and (lines[j][:1] not in ('c', 'e', 'f', 'i', 'l') or re.match(r'^\s', lines[j]) or not re.match(r'^(export (const|function)|const|function)\b', lines[j])):
    j -= 1
assert j >= 0 and re.match(r'^(export (const|function)|const|function)\b', lines[j]), f'{path}: no top-level declaration above L{idx + 1}'
comment = open(cfile).read().rstrip('\n').split('\n')
lines[j:j] = comment
k = idx + len(comment)
lines[k] = f"{ind}`schemaVersion: ${{DECLARED_DOCUMENT_VERSION}}`,"
if not any(re.search(r'\bTeamBlueprint\b', l) for l in lines[:j]):
    IMP = r"'\.\./\.\./domain/blueprint/src/index\.js'"
    merged = [i for i, l in enumerate(lines[:j]) if re.search(r'^import \{[^}]*\} from ' + IMP, l)]
    if merged:
        i = merged[0]
        lines[i] = re.sub(r'^import \{', 'import { type TeamBlueprint,', lines[i])
    else:
        last = max(i for i, l in enumerate(lines[:j]) if re.match(r'^(import\b|\} from)', l))
        lines[last + 1:last + 1] = ["import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'"]
open(path, 'w').write('\n'.join(lines))
print(f'{path}: witness at L{j + 1}, digit line L{k + 1}')
