#!/usr/bin/env python3
"""PROMOTION PROBE (throwaway): re-version ONE carrier family's fixture to the
surviving v3 document — the digit plus the two authority documents v3 REQUIRES.
Nothing else changes: the structured requirements stay declared, byte-identical.

Answers the only question that separates the options: does this family's CLAIM
survive the flip when its document is a legal v3 document?
"""
import re, sys

FILE = sys.argv[1]
ENVELOPES = [
    "permissionMutationEnvelope:", "  rules: []",
    "teamHardEnvelope:", "  rules: []",
]
src = open(FILE).read()
orig = src

# 1) the typed version carrier -> 3
src, n1 = re.subn(r"(const (?:DECLARED|V2)_DOCUMENT_VERSION: TeamBlueprint\['schemaVersion'\] = )2", r"\g<1>3", src)

# 2) inject the two REQUIRED v3 authority documents at each emission site
if "permissionMutationEnvelope:" not in src:
    if "lines.push('requirements: []')" in src:
        src = src.replace(
            "lines.push('requirements: []')",
            "lines.push('requirements: []')\n  lines.push(" + ", ".join(repr(x) for x in ENVELOPES) + ")",
            1,
        )
        n2 = 1
    elif "'requirements: []'," in src:
        src = src.replace("'requirements: [],'", ", ".join(repr(x) + "," for x in ENVELOPES) + " 'requirements: [],'", 1)
        n2 = 1
    else:
        n2 = 0
else:
    n2 = -1  # already carried

open(FILE, "w").write(src)
print(f"{FILE}: version_edits={n1} envelope_injections={n2} changed={src != orig}")
