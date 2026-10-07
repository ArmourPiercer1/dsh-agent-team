#!/usr/bin/env bash
# A4-PR7 Ruling 1 gate driver. Usage: gates.sh <worktree> <out-dir> [full|fast|post]
# Every capture is the command's own bytes, unedited.
set -u
WT="$1"
OUT="$2"
MODE="${3:-fast}"
mkdir -p "$OUT"
cd "$WT" || exit 1

stamp() { echo "=== date: $(date -u +%FT%TZ) | wt: $WT | HEAD: $(git rev-parse HEAD) ==="; }

if [ "$MODE" = "full" ] || [ "$MODE" = "post" ]; then
  for RUN in 1 2; do
    {
      stamp
      echo "########## whole-repo pnpm test — run $RUN (after clearing .tmp-fault) ##########"
      rm -rf packages/testkit/test/.tmp-fault/
      pnpm test 2>&1
      echo "[pnpm-test run$RUN exit=$?]"
    } > "$OUT/full-run$RUN.txt" 2>&1
    echo "full run $RUN finished -> $OUT/full-run$RUN.txt"
  done
fi

if [ "$MODE" = "post" ]; then
  {
    stamp
    echo "########## pnpm build ##########"
    pnpm build 2>&1
    echo "[build exit=$?]"
    echo "########## pnpm build:composition ##########"
    pnpm build:composition 2>&1
    echo "[build:composition exit=$?]"
    echo "########## pnpm run check:artifacts ##########"
    pnpm run check:artifacts 2>&1
    echo "[check:artifacts exit=$?]"
  } > "$OUT/artifacts.txt" 2>&1
  echo "artifacts finished -> $OUT/artifacts.txt"
fi

{
  stamp
  echo "=== porcelain ==="
  git status --porcelain
  echo "########## pnpm -r run typecheck ##########"
  pnpm -r run typecheck 2>&1
  echo "[typecheck exit=$?]"
  echo "########## p4t6 scannable-file inventory (from repo root) ##########"
  pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts 2>&1
  echo "[p4t6 exit=$?]"
  echo "########## a4pr0a (from repo root) ##########"
  pnpm exec vitest run packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts 2>&1
  echo "[a4pr0a exit=$?]"
  echo "########## lint identities vs recorded baseline ##########"
  node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt 2>&1
  echo "[lint-diff exit=$?]"
  echo "########## client lane ##########"
  pnpm --filter @dsh-agent-team/client run test 2>&1
  echo "[client exit=$?]"
} > "$OUT/fast.txt" 2>&1
echo "fast finished -> $OUT/fast.txt"
