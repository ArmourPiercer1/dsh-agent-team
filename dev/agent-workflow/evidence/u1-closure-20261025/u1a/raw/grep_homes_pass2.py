#!/usr/bin/env python3
"""U1-A pass 2 (replacement for grep -P which here only supports a single pattern):
boundary-exact scan of the 38 candidate evidence files for home names."""
import os, re, sys

REPO = "/srv/workspace/dsh-plugins/dsh-agent-team"
U = os.path.join(REPO, "dev/agent-workflow/evidence/u1-closure-20261025/u1a")
names = [l.rstrip("\n") for l in open(os.path.join(U, "raw/home_names.txt")) if l.strip()]
files = [l.rstrip("\n") for l in open(os.path.join(U, "raw/home_ref_candidate_files.txt")) if l.strip()]
# boundary-exact alternation, longest names first so prefix-overlap names win
names_sorted = sorted(names, key=len, reverse=True)
pat = re.compile(r"(?<![A-Za-z0-9._-])(" + "|".join(re.escape(n) for n in names_sorted) + r")(?![A-Za-z0-9._-])")
hits = {}
for f in files:
    p = os.path.join(REPO, f)
    try:
        with open(p, "r", errors="replace") as fh:
            for i, line in enumerate(fh, 1):
                for m in pat.finditer(line):
                    hits.setdefault(m.group(1), []).append(f)
    except Exception as e:
        print("ERR", f, e)
with open(os.path.join(U, "raw/home_ref_hits.txt"), "w") as o:
    for n in sorted(hits):
        uniq = sorted(set(hits[n]))
        o.write(n + "\t" + str(len(hits[n])) + "\t" + ";".join(uniq[:10]) + "\n")
print("REFERENCED_NAMES", len(hits))
