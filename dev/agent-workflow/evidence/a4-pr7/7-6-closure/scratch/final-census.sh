#!/usr/bin/env bash
# Final-tree root census, captured TWICE (plan A1.2.1: the census is captured twice before any
# baseline diff is drawn). Sequential on purpose: two vitest processes at once produced one
# discarded capture on this lane (transcripts/root-census-attempt-overlapped-DISCARD.txt).
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/7-6-closure
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-closure
rm -rf packages/testkit/test/.tmp-fault
for N in 1 2; do
  echo "=== capture $N start $(date -u +%FT%TZ)  HEAD=$(git rev-parse --short HEAD)  tree=$(git status --porcelain | wc -l) dirty paths"
  pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=$EV/scratch/root-census-after-$N.json 2>&1 | tail -400 > $EV/transcripts/root-census-after-$N.txt
  echo "[capture $N exit ${PIPESTATUS[0]}] end $(date -u +%FT%TZ)" | tee -a $EV/transcripts/root-census-after-$N.txt
  grep -E "Test Files|      Tests " $EV/transcripts/root-census-after-$N.txt | tail -2
done
for N in 1 2; do
  node scripts/fail-set.mjs capture $EV/scratch/root-census-after-$N.json --out $EV/scratch/root-ids-after-$N.txt
done
echo "=== ids capture1 vs capture2:"
diff $EV/scratch/root-ids-after-1.txt $EV/scratch/root-ids-after-2.txt && echo "IDENTICAL id sets across the two captures"
wc -l < $EV/scratch/root-ids-after-1.txt
