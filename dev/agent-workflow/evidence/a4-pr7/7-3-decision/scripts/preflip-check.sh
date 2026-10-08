#!/usr/bin/env bash
# Can the option be LANDED BEFORE §7.3? Apply it on an unflipped base and run the
# whole affected universe: any new red means the option cannot be decoupled from
# the flip (it is not a pure v3-behaviour change).
set -u
cd "$(git rev-parse --show-toplevel)"
OPT="$1"; EV=dev/agent-workflow/evidence/a4-pr7/7-3-decision
python3 - "$OPT" <<'PY'
import subprocess, sys
opt = sys.argv[1]
subprocess.run(["git","checkout","d4eb9f39","--","packages"], check=True)
def patch(p, pairs):
    s=open(p).read()
    for o,n in pairs:
        if o not in s: raise SystemExit(f"anchor missing {p}: {o!r}")
        s=s.replace(o,n,1)
    open(p,'w').write(s)
GATES={"packages/runtime/compatibility/blueprint.ts":"  if (blueprint.schemaVersion === 2 && blueprint.teamRequirements !== undefined) {",
       "packages/runtime/requirements/scope-requirements.ts":"  if (blueprint.schemaVersion === 2) {",
       "packages/runtime/requirements/creation-preflight.ts":"  if (blueprint.schemaVersion === 2) {",
       "packages/runtime/admission/requirement-gate.ts":"  if (blueprint.schemaVersion === 2) {"}
if opt=="A":
    for p,a in GATES.items(): patch(p,[(a, a.replace("blueprint.schemaVersion === 2 && ","").replace("if (blueprint.schemaVersion === 2) {","if (true) {"))])
    patch("packages/runtime/activation/provider.ts",[("        blueprint.schemaVersion === 2 ? scopeInputs.templates[createTemplateId] : undefined","        scopeInputs.templates[createTemplateId]")])
elif opt=="B":
    for p,a in GATES.items(): patch(p,[(a, a.replace("blueprint.schemaVersion === 2","false"))])
    patch("packages/runtime/activation/provider.ts",[("        blueprint.schemaVersion === 2 ? scopeInputs.templates[createTemplateId] : undefined","        undefined")])
elif opt=="C":
    v="packages/domain/blueprint/src/validate.ts"; s=open(v).read()
    anchor="  if (schemaVersion === 3) {"
    if anchor not in s: raise SystemExit("C anchor missing")
    s=s.replace(anchor,"""  if (schemaVersion === 3) {
    for (const key of ['teamRequirements']) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        throw teamContractError('MALFORMED_DTO', `field $.${key} is a schemaVersion 2 construct: the §E.2 structured requirement grammar is not part of v3; move it to the flat requirements list or keep the document at schemaVersion 2`)
      }
    }
  }
  if (schemaVersion === 3) {""",1)
    open(v,'w').write(s)
print(f"pre-flip {opt} applied on unflipped base")
PY
rm -rf packages/testkit/test/.tmp-fault
FILES=$(grep -rl "teamRequirements\|V2_DOCUMENT_VERSION\|schemaVersion: 2" packages --include=*.test.ts | grep -v node_modules | grep -v /dist/ | grep -v __probe | sort | tr '\n' ' ')
pnpm exec vitest run $FILES > $EV/transcripts/PREFLIP-$OPT-raw.txt 2>&1
echo "vitest_exit=$?"
grep -E "Test Files|Tests +[0-9]" $EV/transcripts/PREFLIP-$OPT-raw.txt | tail -2
grep -E "^ *× " $EV/transcripts/PREFLIP-$OPT-raw.txt | sed -E 's/^ *× //; s/ [0-9]+ms$//' | sort -u > $EV/transcripts/PREFLIP-$OPT-failing.txt
echo "new_red_titles=$(wc -l < $EV/transcripts/PREFLIP-$OPT-failing.txt)"
