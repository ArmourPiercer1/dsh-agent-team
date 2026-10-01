#!/bin/bash
# light integrated sanity at the post-#50-merge closure head (59b619c6)
# method: identity proof (product tree byte-identical to merged master c19af195 = the verified
# #50 final-head product tree aab72757) -> REUSE the #50 final-head gate evidence for the heavy
# gates (full suite / baseline / a2c7 / typecheck / build / composition) + these light integrated
# re-runs BIND the evidence to the exact closure commit.
set -o pipefail
cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/handoff-closure
E=dev/agent-workflow/evidence/pre-alpha3-refactor/closure
HEAD=$(git rev-parse HEAD)
PORC=$(git status --porcelain)
run() {
  n="$1"; shift
  L="$E/$n.log"
  {
    echo "== $n (closure post-merge light sanity) =="
    echo "HEAD: $HEAD (controlled sync of master c19af195 [#50 merge] onto the closure branch)"
    echo "date: $(date -u +%FT%TZ)"
    echo "git status --porcelain:"
    echo "$PORC"
    echo "\$ $*"
  } > "$L"
  "$@" >> "$L" 2>&1
  ec=$?
  echo "${n^^}_EXIT=$ec" >> "$L"
  echo "=== $n EXIT=$ec ==="
}
# scratch teardown (TEST_METHODS §7 documented destroyDir protocol, manual)
{
  echo "== .tmp-fault scratch teardown (pre-sanity, TEST_METHODS §7) =="
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
} > "$E/post-merge-scratch-teardown.log" 2>&1
run post-merge-p4t6 bash -c "cd packages/testkit && npx vitest run test/p4t6-session-event-scan.test.ts"
run post-merge-check-artifacts node scripts/check-artifacts-committed.mjs
run post-merge-focused-mtm bash -c "cd packages/runtime && npx vitest run test/mcp-target-materialization.test.ts test/mcp-target-materialization-unit.test.ts"
run post-merge-lint pnpm run lint
echo BATTERY_DONE
