#!/usr/bin/env bash
# A4-PR7 Ruling 1, supplement S1 — the absent-reader default gets its own legs.
# Sequential on purpose: the mutation sweep flips production files, so nothing
# else may be running against this worktree at the same time.
set -u
WT=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7b
H=/home/user/dsh-plugins/dsh-agent-team/.tmp-a4pr7b-hold
cd "$WT" || exit 1
MUT=$H/s1/mutations-s1.txt
{
  echo "=== A4-PR7 Ruling 1 — mutation proofs, SUPPLEMENT S1 (full sweep, 9 mutations)."
  echo "=== Each flips PRODUCTION ONLY (never a test), runs the ruling lane, and is reverted from the committed tree."
  echo "=== Head before S1: 73d187bb..aa69cc4b (reviewer-approved). The S1 legs are uncommitted here on purpose:"
  echo "=== the sweep must show the NEW legs burning for the NEW reason, on the tree that adds them."
  echo "=== date: $(date -u +%FT%TZ)   HEAD: $(git rev-parse --short HEAD)   tree: $(git status --porcelain | grep -c '') file(s) modified (the test file only)"
  echo "=== git status --porcelain (proof no mutation of a production file survives the run):"
  git status --porcelain
  for m in M1-collapse-unreadable-to-current M2-collapse-unreadable-to-migration-required \
           M3-unwire-the-root-reader M4-drop-the-payload-field M5-render-collapses-arm-1 \
           M6-render-collapses-arm-2 M7-boolean-comes-back M8-default-becomes-current \
           M9-closed-set-check-dropped; do
    python3 "$H/mutate.py" "$m"
    echo
  done
  echo "=== FINAL: git status --porcelain after all reverts (only the S1 test file may appear):"
  git status --porcelain
} > "$MUT" 2>&1
echo "mutations -> $MUT"
bash "$H/gates.sh" "$WT" "$H/s1" full
echo "gates -> $H/s1"
