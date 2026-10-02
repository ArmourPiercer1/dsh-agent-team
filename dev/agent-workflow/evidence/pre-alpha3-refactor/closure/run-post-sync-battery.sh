#!/bin/bash
# post-sync verification battery (closure head after controlled merge of origin/master 26c48c87)
set -o pipefail
cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/handoff-closure
E=dev/agent-workflow/evidence/pre-alpha3-refactor/closure
HEAD=$(git rev-parse HEAD)
DATE=$(date -u +%FT%TZ)
PORC=$(git status --porcelain)
run() {
  n="$1"; shift
  L="$E/$n.log"
  {
    echo "== $n (closure post-sync battery) =="
    echo "HEAD: $HEAD (merge of 0319c33f [closure docs] + 26c48c87 [origin/master = PR #49])"
    echo "date: $DATE"
    echo "git status --porcelain:"
    echo "$PORC"
    echo "\$ $*"
  } > "$L"
  "$@" >> "$L" 2>&1
  ec=$?
  echo "${n^^}_EXIT=$ec" >> "$L"
  echo "=== $n EXIT=$ec ==="
}
# scratch teardown (TEST_METHODS §7 documented destroyDir protocol, manual) — pre-battery
{
  echo "== .tmp-fault scratch teardown (pre-battery, TEST_METHODS §7) =="
  echo "HEAD: $HEAD"
  echo "date: $(date -u +%FT%TZ)"
  echo "\$ ls packages/testkit/test/.tmp-fault/ (pre-cleanup)"
  ls packages/testkit/test/.tmp-fault/ 2>&1
  echo "EXIT_LS_PRE=$?"
  echo "\$ rm -rf packages/testkit/test/.tmp-fault/*"
  rm -rf packages/testkit/test/.tmp-fault/*
  echo "EXIT_RM=$?"
  echo "\$ ls -la packages/testkit/test/.tmp-fault/ (post-cleanup)"
  ls -la packages/testkit/test/.tmp-fault/ 2>&1
  echo "EXIT_LS_POST=$?"
} > "$E/post-sync-scratch-teardown.log" 2>&1
cat "$E/post-sync-scratch-teardown.log" | tail -4
run post-sync-typecheck pnpm -r run typecheck
run post-sync-build pnpm -r run build
run post-sync-composition pnpm build:composition
run post-sync-check-artifacts node scripts/check-artifacts-committed.mjs
run post-sync-lint pnpm run lint
run post-sync-p4t6 npx vitest run test/p4t6-session-event-scan.test.ts --root packages/testkit
run post-sync-full-suite pnpm test
echo BATTERY_DONE
