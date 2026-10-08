#!/usr/bin/env python3
"""Element-set census for cordis.patch.yml's blueprintSource block (raw YAML, not a quote carrier).

Usage: yaml-element-census.py <base-rev> [path]     (path defaults to cordis.patch.yml)

WHY A COMPANION. The element-set census (7-3-fixtures/tools/element-set-census-quotedfix.py)
extracts elements from TEMPLATE LITERALS and SINGLE-QUOTED STRINGS — the carriers of `.ts`
fixture files. cordis.patch.yml is a raw YAML data file: the document sits at top level behind
a `blueprintSource: |` block scalar, with NO quote carrier anywhere in sight. Run the shared
tool on this file and it reports `elements 0 ... anomalies 0` — a clean bill of health for a
file it read ZERO elements of. That vacuous zero is exactly the shape of the a2c7 defect this
family exists to catch, so the shared tool must not be the last word here: this companion does
the same job on the block scalar, reusing the shared tool's OWN element regexes so it cannot
disagree with it about what an element is.

Rules on the base→work pair of the block (comments stripped, block dedented, document order):
  Y1  LOST  = Counter(base) - Counter(work) contains ONLY version-carrying elements;
  Y2  GAINED = Counter(work) - Counter(base) contains ONLY the pair elements or version elements;
  Y3  the four pair elements are adjacent in the work stream;
  Y4  every indented `rules: []` directly follows its envelope key element;
  Y5  the count of version-carrying elements is unchanged (document not added, lost or split);
  Y6  the work stream minus the pair, with the version element normalized, equals the base
      stream with the version element normalized (nothing MOVED or changed shape silently).

Exit 0 = no anomalies; exit 2 = the block could not be extracted (never a silent zero).
"""
import collections
import os
import re
import subprocess
import sys

# NO BYTECODE CACHE — importing a tracked evidence module would otherwise write a tracked .pyc
# and dirty the tree (measured upstream: merge-gate reported "1 untracked entr(ies)" for it).
sys.dont_write_bytecode = True
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "census", os.path.join(HERE, "..", "..", "7-3-fixtures", "tools", "element-set-census-quotedfix.py"))
census = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(census)

BLOCK_HEAD = re.compile(r"^(\s*)blueprintSource:\s*\|\s*$")


def extract_block(text: str):
    """The `blueprintSource: |` block scalar, dedented to the document's own indentation."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        m = BLOCK_HEAD.match(line)
        if not m:
            continue
        indent = len(m.group(1))
        block = []
        body_indent = None
        for nxt in lines[i + 1:]:
            if nxt.strip() == "":
                block.append("")
                continue
            cur = len(nxt) - len(nxt.lstrip(" "))
            if cur <= indent:
                break
            if body_indent is None:
                body_indent = cur
            block.append(nxt[body_indent:] if len(nxt) >= body_indent else nxt.lstrip(" "))
        return block
    return None


def elements(block):
    """Document elements in order: YAML comments and blanks removed, nothing else touched.
    Matched the way the shared tool matches template-literal lines — YAMLISH against the STRIPPED
    line, relative indentation preserved (that is what makes `  rules: []` its own element)."""
    out = []
    for line in block:
        s = line.rstrip()
        if s.strip() == "" or s.lstrip().startswith("#"):
            continue
        if census.YAMLISH.match(s.strip()):
            out.append(s)
    return out


def is_version(e):
    return bool(census.VERSION.match(e))


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    base_rev = argv[1]
    path = argv[2] if len(argv) > 2 else "cordis.patch.yml"
    work_text = open(path, encoding="utf-8").read()
    base_text = subprocess.run(["git", "show", f"{base_rev}:{path}"], capture_output=True,
                               text=True, check=True).stdout
    wb, bb = extract_block(work_text), extract_block(base_text)
    if wb is None or bb is None:
        print(f"!! blueprintSource block scalar not found ({path}) — refusing to read a missing block as zero elements")
        return 2
    we, be = elements(wb), elements(bb)
    print(f"base elements {len(be)}  work elements {len(we)}  (comments removed, document order)")
    bad = []
    lost = collections.Counter(be) - collections.Counter(we)
    gained = collections.Counter(we) - collections.Counter(be)
    for e, n in sorted(lost.items()):
        tag = "ok" if is_version(e) else "!!"
        if not is_version(e):
            bad.append(f"Y1 lost element that is not a version element: {e!r} x{n}")
        print(f"  LOST {tag} {e!r} x{n}")
    pair = set(census.PAIR)
    for e, n in sorted(gained.items()):
        ok = is_version(e) or e in pair
        if not ok:
            bad.append(f"Y2 gained element outside the pair/version vocabulary: {e!r} x{n}")
        print(f"  GAINED {'ok' if ok else '!!'} {e!r} x{n}")
    # Y3 adjacency of the four pair elements in the work stream
    idx = [i for i, e in enumerate(we) if e in census.PAIR]
    seq = [we[i] for i in idx]
    if seq != census.PAIR:
        bad.append(f"Y3 pair elements not adjacent/ordered in the work stream: {seq}")
    if len(idx) != 4:
        bad.append(f"Y3 expected exactly 4 pair elements in the work stream, found {len(idx)}")
    # Y4 each rules: [] directly follows its envelope key
    for i, e in enumerate(we):
        if e == "  rules: []" and (i == 0 or we[i - 1] not in ("permissionMutationEnvelope:", "teamHardEnvelope:")):
            bad.append(f"Y4 indented rules: [] at stream position {i} does not follow an envelope key")
    # Y5 version count unchanged
    if sum(1 for e in be if is_version(e)) != sum(1 for e in we if is_version(e)):
        bad.append("Y5 version-element count changed — a document was added, lost or split")
    # Y6 stream identity modulo version + pair
    def norm(stream, drop_pair):
        out = []
        for e in stream:
            if is_version(e):
                out.append("schemaVersion:<V>")
            elif drop_pair and e in pair:
                continue
            else:
                out.append(e)
        return out
    if norm(be, False) != norm(we, True):
        bad.append("Y6 work stream (minus pair, version normalized) differs from base stream — something moved or changed shape")
    print("-" * 72)
    for x in bad:
        print(" ", x)
    print(f"anomalies {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
