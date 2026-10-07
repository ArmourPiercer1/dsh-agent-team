#!/usr/bin/env python3
"""Element-set census for a document-literal migration.  Usage:

    element-set-census.py <base-rev> [path ...]     (paths default to the base..work diff)

WHY THIS EXISTS AND NOT A LINE DIFF.  A line diff cannot see the silent-drop family:
`metadata: {}`, `requirements: []`, `members: []`, `memberEnvelopes: []` and `policyStates: []`
are each produced by a default (`?? []` / `?? {}`) in packages/domain/blueprint/src/validate.ts
(1240/1258/1291/1350), so dropping any one of them - or all five together - yields an identical
parse AND an identical contentHash.  A fixture can lose a document element with no test, no type
and no hash noticing it.  This lane hit exactly that: `a2c7-subtree-matcher.test.ts` lost a
`'metadata: {}'` element and stayed 31/31 green, typecheck-clean and fence-clean.

A line diff is blind in the other direction too, on the inline house shape where several YAML
elements share one `lines.push(...)` line: a line-level "this line merely gained envelope
elements" excuse proves nothing was dropped and says nothing about WHERE the pair landed (a2c7's
lost `metadata` sat two lines under exactly such a push).

So the unit of evidence is the file's ELEMENT STREAM in document order, comments removed, and the
comparison is element-set/sequence, never line identity.  Rules, all violations reported:

  R1  every removed element is a version-carrying element;
  R2  every inserted element is the required-envelope pair or a version element;
  R3  the four pair elements are adjacent in the stream;
  R4  the pair sits in the same `---`-delimited region as the nearest preceding version element
      (a pair past the closing fence belongs to the next document);
  R5  every indented `rules: []` element directly follows a key element (the nesting form);
  R6  the number of version-carrying elements is unchanged (no document added, lost or split).

Exit 0 = no anomalies.  This is a screen over literal structure, not a parse: for a document a
test actually parses, the parse witness remains the authority.
"""
import difflib
import re
import subprocess
import sys

PAIR = ["permissionMutationEnvelope:", "  rules: []", "teamHardEnvelope:", "  rules: []"]
VERSION = re.compile(r"^schemaVersion:\s*(?:\$\{[A-Za-z_]+\}|\d+)$")
KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*:")
YAMLISH = re.compile(r"^(?:---|-\s.*|[A-Za-z_][A-Za-z0-9_.]*:.*|\s+-\s.*)$")

TEMPLATE = re.compile(r"`(?:[^`\\]|\\.)*`", re.S)
SQUOTE = re.compile(r"'((?:[^'\\\n]|\\.)*)'")

# Third house shape: a whole document inside ONE single-quoted string with escaped newlines,
# used by the two delete-lie files. Those tokens are split on the two-character `\n`.
ESCAPED = re.compile(r"\\n")

# Disclosed exceptions: a version claim that was DELETED rather than migrated, because nothing
# parses the string (see FINDINGS §3, delete-lie rows). Printed, never suppressed.
DELETE_LIE = {
    "packages/runtime/test/mcp-supply-config.test.ts":
        "blueprintSource is only checked to be a non-empty string (src/plugin/host.ts:612); "
        "the version claim is deleted with the document body, not migrated",
    "packages/runtime/test/p8s5a-host-loadability.test.ts":
        "same: no reader consults the version in this string, so the claim is deleted",
}


def strip_comments(text):
    """Blank `//` and block comments out (keeping newlines), leaving string literals intact so
    prose in a comment can never be counted as a document element."""
    out, i, n = [], 0, len(text)
    while i < n:
        two = text[i:i + 2]
        if two == "//":
            j = text.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i))
            i = j
        elif two == "/*":
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("".join(c if c == "\n" else " " for c in text[i:j]))
            i = j
        elif text[i] in "'\"`":
            q, j = text[i], i + 1
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == q:
                    break
                j += 1
            out.append(text[i:min(j + 1, n)])
            i = j + 1
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def elements(text):
    """Elements in source order: template-literal document lines (in that shape the lines ARE the
    YAML) and single-quoted array elements; template bodies are masked out before the quoted pass
    so nothing is counted twice."""
    src = strip_comments(text)
    found, spans = [], []
    for m in TEMPLATE.finditer(src):
        spans.append(m.span())
        raw = [l for l in m.group(0)[1:-1].split("\n") if l.strip()]
        pad = min((len(l) - len(l.lstrip()) for l in raw), default=0)
        for off, line in enumerate(m.group(0)[1:-1].split("\n")):
            t = line[pad:].rstrip()
            if t.strip() and YAMLISH.match(t.strip()):
                found.append((m.start() + off, t))
    rest = list(src)
    for a, b in spans:
        for k in range(a, b):
            rest[k] = " "
    for m in SQUOTE.finditer("".join(rest)):
        for part in ESCAPED.split(m.group(1)):
            t = part.rstrip()
            if t.strip() and YAMLISH.match(t.strip()):
                found.append((m.start(), t))
    found.sort(key=lambda x: x[0])
    return [t for _, t in found]


def read(rev, path):
    if rev in (".", "WORK"):
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    return subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True,
                          text=True, check=True).stdout


def region(stream, idx):
    return sum(1 for i in range(idx) if stream[i] == "---")


def groups(ids):
    run = []
    for x in ids:
        if run and x == run[-1] + 1:
            run.append(x)
        else:
            if run:
                yield run
            run = [x]
    if run:
        yield run


def check_stream(path, tag, stream):
    bad = []
    for g in groups([i for i, x in enumerate(stream) if x in PAIR]):
        if len(g) != 4:
            bad.append(f"{path}: [{tag}] envelope pair not contiguous at element {g[0]} "
                       f"(run length {len(g)})")
        v = max((i for i in range(g[0], -1, -1) if VERSION.match(stream[i])), default=None)
        if v is not None and region(stream, g[0]) != region(stream, v):
            bad.append(f"{path}: [{tag}] envelope pair at element {g[0]} is outside the document "
                       f"declaring its version (fence region {region(stream, g[0])} vs "
                       f"{region(stream, v)})")
    for i, x in enumerate(stream):
        if x in ("  rules: []", "    rules: []") and (i == 0 or not KEY.match(stream[i - 1])):
            bad.append(f"{path}: [{tag}] `{x}` at element {i} does not follow a key element")
    return bad


def census(path, base, head):
    eb, eh = elements(base), elements(head)
    notes = []
    bad = check_stream(path, "base", eb) + check_stream(path, "head", eh)
    vb, vh = sum(1 for x in eb if VERSION.match(x)), sum(1 for x in eh if VERSION.match(x))
    if vb != vh:
        if path in DELETE_LIE and vh < vb:
            notes.append(f"{path}: version-carrying elements {vb} -> {vh} — DISCLOSED delete-lie: "
                         + DELETE_LIE[path])
        else:
            bad.append(f"{path}: version-carrying element count {vb} -> {vh} "
                       f"(a document was added, lost or split; not a disclosed delete-lie)")
    regions = 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, eb, eh, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        regions += 1
        rem, ins = eb[i1:i2], eh[j1:j2]
        stray_rem = [x for x in rem if not VERSION.match(x)]
        if stray_rem:
            bad.append(f"{path}: removal that is not a version element: {stray_rem[:5]}")
        stray_ins = [x for x in ins if x not in PAIR and not VERSION.match(x)]
        if stray_ins:
            bad.append(f"{path}: insertion that is neither the pair nor a version element: "
                       f"{stray_ins[:5]}")
    return regions, len(eh), bad, notes


GOOD = """
const DOC = [
  '---',
  'schemaVersion: 3',
  'blueprintId: x',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'metadata: {}',
  '---',
].join('\\n')
"""

BAD = {
    # pair pushed past the document-closing fence: same elements, wrong document
    "pair-after-fence": GOOD.replace(
        "  'metadata: {}',\n  '---',", "  '---',\n  'permissionMutationEnvelope:',\n"
        "  '  rules: []',\n  'teamHardEnvelope:',\n  '  rules: []',\n  'metadata: {}',"),
    # rules element orphaned from its key (wrong nesting)
    "orphaned-rules": GOOD.replace("  'permissionMutationEnvelope:',\n  '  rules: []',",
                                   "  '  rules: []',\n  'permissionMutationEnvelope:',"),
    # pair split by an unrelated element (non-contiguous)
    "split-pair": GOOD.replace("  '  rules: []',\n  'teamHardEnvelope:',",
                               "  '  rules: []',\n  'metadata: {}',\n  'teamHardEnvelope:',"),
}


def self_test():
    """Prove the screen can see what it claims to see. A screen that reports 0 anomalies while
    blind is worse than no screen, and two earlier revisions of this tool were exactly that
    (they reported `0 audited`). Each mutant must raise at least one anomaly."""
    ok = True
    base, bad = census("t.ts", GOOD, GOOD), None
    if base[2]:
        print("  !! self-test: the good fixture is not clean:", base[2])
        ok = False
    for name, mutant in BAD.items():
        got = census("t.ts", GOOD, mutant)[2]
        print(f"  {'PASS' if got else 'FAIL'}  {name:18} -> {len(got)} anomal(y|ies)"
              + (f": {got[0].split(': ', 1)[1]}" if got else " (SCREEN IS BLIND HERE)"))
        ok = ok and bool(got)
    dropped = GOOD.replace("  'metadata: {}',\n", "")
    got = census("t.ts", GOOD, dropped)[2]
    print(f"  {'PASS' if got else 'FAIL'}  dropped-metadata -> {len(got)} anomal(y|ies)"
          + (f": {got[0].split(': ', 1)[1]}" if got else " (SCREEN IS BLIND HERE)"))
    return 0 if ok and got else 1


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--self-test":
        return self_test()
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    base = sys.argv[1]
    paths = sys.argv[2:] or subprocess.run(
        ["git", "diff", "--name-only", base, "--", "packages/runtime/test"],
        capture_output=True, text=True).stdout.split()
    paths = [p for p in paths if p.endswith((".ts", ".tsx"))]
    tot_regions, tot_elems, allbad, allnotes = 0, 0, [], []
    for p in paths:
        try:
            r, n, bad, notes = census(p, read(base, p), read(".", p))
        except Exception as exc:                                       # noqa: BLE001
            r, n, bad, notes = 0, 0, [f"{p}: census error {type(exc).__name__}: {exc}"], []
        tot_regions += r
        tot_elems += n
        allbad += bad
        allnotes += notes
        print(f"{p.split('/')[-1]:52} elements {n:4}  changed regions {r:2}  anomalies {len(bad)}")
    print("-" * 92)
    print(f"files {len(paths)}   head document elements seen {tot_elems}   "
          f"changed element regions {tot_regions}   anomalies {len(allbad)}")
    for x in allnotes:
        print("  ~~", x)
    for x in allbad:
        print("  !!", x)
    return 1 if allbad else 0


if __name__ == "__main__":
    sys.exit(main())
