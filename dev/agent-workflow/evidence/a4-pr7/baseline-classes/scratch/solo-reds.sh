#!/usr/bin/env bash
# Solo reproduction capture: does each titled-red FILE reproduce alone, outside the census load?
# (Answers "is this a load casualty or a property of the tree?" for the eight relay legs, D3-4,
# the nine domain legs and the tools leg, in one sequential vitest invocation.)
# Also gives the FULL un-truncated assertion text for D3-4 (the census transcript truncates it).
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/baseline-classes
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-baseline-classes
rm -rf packages/testkit/test/.tmp-fault
echo "=== solo-red capture start $(date -u +%FT%TZ)"
pnpm exec vitest run \
  packages/domain/test/t1-capability-schema.test.ts \
  packages/domain/test/t2-blueprint-hash.test.ts \
  packages/runtime/test/d3-member-identity-context.test.ts \
  packages/runtime/test/p6t3-mediation.test.ts \
  packages/runtime/test/p6t3-restart.test.ts \
  packages/tools/test/p6t6-actions.test.ts \
  --reporter=default --reporter=json --outputFile.json=$EV/raw/solo-reds.json \
  > $EV/transcripts/solo-reds.txt 2>&1
echo "[exit $?] end $(date -u +%FT%TZ)"
grep -E "Test Files|Tests |Duration " $EV/transcripts/solo-reds.txt | tail -3
node scripts/fail-set.mjs capture $EV/raw/solo-reds.json --out $EV/scratch/solo-reds.ids.txt
echo "--- solo ids vs census ids:"
diff <(sort $EV/scratch/solo-reds.ids.txt) <(sort $EV/scratch/full-1.ids.txt | grep -v COLLECTION) && echo "SOLO == CENSUS (minus collection files): the reds are properties of the tree, not of load"
