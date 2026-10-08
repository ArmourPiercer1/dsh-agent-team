#!/usr/bin/env bash
# Capture the COLLECTION ERRORS of the three baseline collection-error files, solo, so the
# transcript shows the import/module that kills collection (the vitest JSON reporter records
# status=failed with zero assertionResults and NO failureMessages for these, which is exactly
# why nobody has ever said what breaks them).
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/baseline-classes
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-baseline-classes
rm -rf packages/testkit/test/.tmp-fault
echo "=== collection-error capture start $(date -u +%FT%TZ)"
pnpm exec vitest run \
  packages/runtime/test/p8s3b-result-effects.test.ts \
  packages/runtime/test/t12a-b2-child-identity.test.ts \
  packages/runtime/test/t12a-glue-handoff-ports.test.ts \
  --reporter=default \
  --reporter=json --outputFile.json=$EV/raw/collection-errors.json \
  > $EV/transcripts/collection-errors.txt 2>&1
echo "[exit $?] end $(date -u +%FT%TZ)"
grep -E "Test Files|Tests |Duration " $EV/transcripts/collection-errors.txt | tail -3
node scripts/fail-set.mjs capture $EV/raw/collection-errors.json --out $EV/scratch/collection-errors.ids.txt
cat $EV/scratch/collection-errors.ids.txt
