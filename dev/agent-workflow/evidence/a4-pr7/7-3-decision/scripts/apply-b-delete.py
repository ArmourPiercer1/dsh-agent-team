#!/usr/bin/env python3
"""B as it would really be written: DELETE the guarded blocks, not deaden them."""
import subprocess, sys
subprocess.run(["python3","dev/agent-workflow/evidence/a4-pr7/7-3-decision/scripts/apply-option.py","d4eb9f39","flip"],check=True)

def delete_block(path, anchor):
    lines = open(path).read().split("\n")
    try:
        i = next(k for k,l in enumerate(lines) if l.rstrip() == anchor)
    except StopIteration:
        raise SystemExit(f"anchor not found in {path}: {anchor!r}")
    depth = 0
    for k in range(i, len(lines)):
        depth += lines[k].count("{") - lines[k].count("}")
        if k >= i and depth == 0:
            del lines[i:k+1]
            open(path,"w").write("\n".join(lines))
            return k-i+1
    raise SystemExit(f"unbalanced block in {path}")

removed = 0
removed += delete_block("packages/runtime/compatibility/blueprint.ts",
    "  if (blueprint.schemaVersion === 2 && blueprint.teamRequirements !== undefined) {")
for p in ["packages/runtime/requirements/scope-requirements.ts",
          "packages/runtime/requirements/creation-preflight.ts",
          "packages/runtime/admission/requirement-gate.ts"]:
    removed += delete_block(p, "  if (blueprint.schemaVersion === 2) {")
p = "packages/runtime/activation/provider.ts"; s = open(p).read()
s = s.replace("        blueprint.schemaVersion === 2 ? scopeInputs.templates[createTemplateId] : undefined\n",
              "        undefined\n", 1)
open(p,"w").write(s)
print(f"B-delete applied; guarded lines removed = {removed}")
