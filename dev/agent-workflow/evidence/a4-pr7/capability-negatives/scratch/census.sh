#!/usr/bin/env bash
# Nine-root census driver for the BASELINE-CLASSES lane.
# Form copied from dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/final-census.sh:
# one root `vitest run` per capture, SEQUENTIAL (two overlapping vitest processes produced a
# discarded capture on that lane), CI=true, XDG_CACHE_HOME inside the workspace, and
# `rm -rf packages/testkit/test/.tmp-fault` before each run.
# Roots = every packages/*/test directory reached by the root vitest.config.ts include
# pattern `packages/*/test/**/*.test.ts` = contracts domain legacy remote runtime storage
# testkit tools client (nine roots, named explicitly in the per-root breakdown below).
#
# Usage: ./census.sh <label> <n-captures>
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/capability-negatives
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-capability-negatives
LABEL=${1:-census}
N=${2:-1}
for i in $(seq 1 "$N"); do
  echo "=== capture $LABEL-$i start $(date -u +%FT%TZ) HEAD=$(git rev-parse --short HEAD) dirty=$(git status --porcelain | grep -vc 'capability-negatives/') pids=$(pgrep -c -f vitest || true)"
  rm -rf packages/testkit/test/.tmp-fault
  pnpm exec vitest run --reporter=default --reporter=json \
    --outputFile.json=$EV/raw/$LABEL-$i.json \
    > $EV/transcripts/$LABEL-$i.txt 2>&1
  rc=$?
  echo "[capture $LABEL-$i exit $rc] end $(date -u +%FT%TZ)" | tee -a $EV/transcripts/$LABEL-$i.txt
  grep -E "Test Files|Tests |Duration " $EV/transcripts/$LABEL-$i.txt | tail -4
  node scripts/fail-set.mjs capture $EV/raw/$LABEL-$i.json --out $EV/scratch/$LABEL-$i.ids.txt
  echo "ids=$(wc -l < $EV/scratch/$LABEL-$i.ids.txt)"
done
