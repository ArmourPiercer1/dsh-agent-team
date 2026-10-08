#!/usr/bin/env python3
"""Multiset element census: the one question the silent-drop family actually poses.

Usage: multiset-census.py <base-rev> <path> [<path> ...]

WHY A COMPANION AND NOT JUST THE R1-R6 RUN. The element-set census
(7-4-b2a/tools/element-set-census.py) reports a flag per difflib CHANGED REGION. When two
adjacent fixtures both change their version element and one of them also gains a four-element
block, difflib picks a different-but-equivalent alignment, and the tool prints the same five
elements as both "inserted" and "removed" — a re-alignment, indistinguishable, in its own
output, from a real move. That is the difference between "the probe had to change shape" and
"the probe lost an element", and this file answers exactly that, per element STRING:

  LOST  = elements present at <base-rev> and absent now, with multiplicity
  GAINED= elements present now and absent at <base-rev>

Every LOST element must be a version-carrying element. Anything else in LOST is the a2c7
defect (a dropped `metadata: {}` that no test, type or hash can see) and exits 1.
It reuses the census's own element extractor, so it cannot disagree with it about what an
element is.
"""
import collections
import os
import sys

# NO BYTECODE CACHE. The 7-4-b2a evidence directory tracks a __pycache__/*.pyc, so importing a
# census module writes into a tracked path and dirties whichever tree ran the tool -- measured:
# the main workspace came back modified after one census run, and the merge gate then reported
# "1 untracked entr(ies)" for its own tree-state field. Evidence tools must not write anywhere.
sys.dont_write_bytecode = True
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "census", os.path.join(HERE, "element-set-census-quotedfix.py"))
census = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(census)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    rev, paths = argv[1], argv[2:]
    bad = 0
    for path in paths:
        head = census.elements(census.read(rev, path))
        work = census.elements(census.read("WORK", path))
        lost = collections.Counter(head) - collections.Counter(work)
        gained = collections.Counter(work) - collections.Counter(head)
        lost_bad = {e: n for e, n in lost.items()
                    if not census.VERSION.match(e) and e not in census.PAIR}
        gained_bad = {e: n for e, n in gained.items()
                      if not census.VERSION.match(e) and e not in census.PAIR}
        print(f"{os.path.basename(path):<40s} head {len(head):4d}  work {len(work):4d}  "
              f"version-elements {sum(1 for x in head if census.VERSION.match(x))}"
              f"/{sum(1 for x in work if census.VERSION.match(x))}")
        print(f"   LOST   : {dict(lost) or 'NONE'}")
        print(f"   GAINED : {dict(gained) or 'NONE'}")
        if lost_bad:
            print(f"   !! LOST element that is neither a version element nor the pair: {lost_bad}")
            bad += 1
        if gained_bad:
            print(f"   note   : gained non-version elements {gained_bad}")
            print("            (a GAIN is not the silent-drop defect; it is reported so an added"
                  " document body is never mistaken for a migrated one)")
    print(f"files {len(paths)}  files with a non-version element LOST {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
