#!/usr/bin/env python3
"""Reproduce p4t6's scan-count arithmetic the way the test itself derives it.

The ratchet never writes a total by hand: it asserts
`scanResult.filesScanned == 983 + Σ SCANNED_PATHS_*.length` over a named set of lists.
So the honest way to report the number is to read the asserted expression and evaluate
exactly the lists it names — not to grep for `NAME = <number>` (an earlier attempt here did
that, matched nothing, and printed an empty sum).

Usage: scan_count_derivation.py [test-file ...]      (default: merged + lane base)
"""
import re
import subprocess
import sys


def lists_of(src):
    out = {}
    for name in re.findall(r"const (SCANNED_PATHS_[A-Z0-9]+): readonly string\[\] = \[", src):
        i = src.index(f"const {name}: readonly string[] = [")
        i = src.index("[", i + len(f"const {name}: readonly string[] = "))
        out[name] = re.findall(r"'([^']+)'", src[i:src.index("\n    ]", i)])
    return out


def arithmetic(path, text):
    lsts = lists_of(text)
    m = re.search(r"expect\(scanResult\.filesScanned\)\.toBe\(\s*(\d+) \+(.*?)\,\s*\)", text, re.S)
    base, expr = int(m.group(1)), m.group(2)
    used = re.findall(r"(SCANNED_PATHS_[A-Z0-9]+)\.length", expr)
    total = base + sum(len(lsts[n]) for n in used)
    print(f"{path}")
    short = lambda n: n.replace("SCANNED_PATHS_", "")
    print(f"  asserted: filesScanned == {base} + "
          + " + ".join(f"{short(n)}[{len(lsts[n])}]" for n in used))
    print(f"  total: {base} + {sum(len(lsts[n]) for n in used)} = {total}   "
          f"({len(used)} of {len(lsts)} blocks are in the sum; the rest are inside the base)")
    print(f"  SCANNED_PATHS_A474B2A present: {any('A474B2A' in n for n in lsts)} "
          f"(correct if False: this lane adds no scannable file)")
    return total


def main():
    paths = sys.argv[1:] or ["packages/testkit/test/p4t6-session-event-scan.test.ts", "BASE"]
    totals = {}
    for p in paths:
        if p == "BASE":
            text = subprocess.run(["git", "show", "a4ef2a6b:packages/testkit/test/"
                                             "p4t6-session-event-scan.test.ts"],
                                  capture_output=True, text=True, check=True).stdout
            p = "packages/testkit/test/p4t6-session-event-scan.test.ts  @ a4ef2a6b (lane base)"
        else:
            text = open(p).read()
        totals[p] = arithmetic(p, text)
    vals = list(totals.values())
    if len(vals) == 2:
        print(f"  movement between the lane base and the merged tree: {vals[1]} -> {vals[0]} "
              f"(+{vals[0] - vals[1]}), from master's own blocks — not this lane's")
    return 0


if __name__ == "__main__":
    sys.exit(main())
