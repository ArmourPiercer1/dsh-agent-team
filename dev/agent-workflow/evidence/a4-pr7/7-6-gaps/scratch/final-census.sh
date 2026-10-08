#!/usr/bin/env bash
# Nine-root census on THIS lane's final tree, captured TWICE, strictly sequentially
# (plan A1.2.1; an overlapped pair on `7-6-closure` produced a discarded capture —
# see dev/agent-workflow/evidence/a4-pr7/7-6-closure/transcripts/root-census-attempt-overlapped-DISCARD.txt).
# One `vitest run` from the worktree root = the nine `packages/*/test` roots named in
# population-baseline/nine-root-2162f6a7.md: contracts domain legacy remote runtime
# storage testkit tools client.
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/7-6-gaps
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-scenario-gaps
rm -rf packages/runtime/test/.tmp-fault packages/testkit/test/.tmp-fault
for N in 1 2; do
  echo "=== capture $N start $(date -u +%FT%TZ)  HEAD=$(git rev-parse --short HEAD)  $(git status --porcelain | wc -l) dirty paths"
  pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=$EV/scratch/root-census-$N.json 2>&1 | tail -400 > $EV/transcripts/root-census-$N.txt
  echo "[capture $N exit ${PIPESTATUS[0]}] end $(date -u +%FT%TZ)" | tee -a $EV/transcripts/root-census-$N.txt
  grep -E "Test Files|      Tests " $EV/transcripts/root-census-$N.txt | tail -2
done
for N in 1 2; do
  node scripts/fail-set.mjs capture $EV/scratch/root-census-$N.json --out $EV/scratch/root-ids-$N.txt
done
echo "=== ids capture1 vs capture2:"
diff $EV/scratch/root-ids-1.txt $EV/scratch/root-ids-2.txt && echo "IDENTICAL id sets across the two captures"
wc -l < $EV/scratch/root-ids-1.txt
