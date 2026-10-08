#!/usr/bin/env bash
# Nine-root census driver for the `fix-a4-collection-errors-32` lane.
# Form copied from dev/agent-workflow/evidence/a4-pr7/baseline-classes/scratch/census.sh
# (itself from 7-6-closure/scratch/final-census.sh): ONE root `vitest run` per capture,
# SEQUENTIAL (two overlapping vitest processes produced a discarded capture on an earlier
# lane), CI=true, XDG_CACHE_HOME inside the workspace, `rm -rf packages/testkit/test/.tmp-fault`
# before each run.
#
# ROOTS, NAMED (every packages/*/test directory reached by the root vitest.config.ts include
# pattern `packages/*/test/**/*.test.ts`): contracts domain legacy remote runtime storage
# testkit tools client — nine roots. The comparison is always by IDENTITY SET, never by count.
#
# THIS LANE RUNS EXACTLY ONE CAPTURE (three other lanes were measuring failure rates on this
# machine concurrently); the single-capture fact is stated in FINDINGS.md.
#
# Usage: ./census.sh <label>
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/collection-errors
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-collection-errors-32
LABEL=${1:-census}
mkdir -p $EV/raw $EV/scratch $EV/transcripts
echo "=== capture $LABEL start $(date -u +%FT%TZ) HEAD=$(git rev-parse --short HEAD) dirty=$(git status --porcelain | grep -vc 'collection-errors/') pids=$(pgrep -c -f vitest || true)"
rm -rf packages/testkit/test/.tmp-fault
pnpm exec vitest run --reporter=default --reporter=json \
  --outputFile.json=$EV/raw/$LABEL.json \
  > $EV/transcripts/$LABEL.txt 2>&1
rc=$?
echo "[capture $LABEL exit $rc] end $(date -u +%FT%TZ)" | tee -a $EV/transcripts/$LABEL.txt
grep -E "Test Files|Tests |Duration " $EV/transcripts/$LABEL.txt | tail -4
node scripts/fail-set.mjs capture $EV/raw/$LABEL.json --out $EV/scratch/$LABEL.ids.txt
echo "failing ids=$(wc -l < $EV/scratch/$LABEL.ids.txt)"
node $EV/scratch/leg-set.mjs $EV/raw/$LABEL.json $EV/scratch/$LABEL.legs.txt $EV/scratch/$LABEL.roots.txt
