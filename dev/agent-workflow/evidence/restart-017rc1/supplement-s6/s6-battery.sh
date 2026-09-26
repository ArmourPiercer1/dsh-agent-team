#!/usr/bin/env bash
# S6 final-tip battery (PR #31 supplemental fix round, guide §6/§9).
# Runs AFTER the S5 kit worlds have fully settled (no heavy suites while
# kit worlds run — p6t1-parallel load flake, proven pre-existing).
#
# Usage (from the worktree root):
#   bash dev/agent-workflow/evidence/restart-017rc1/supplement-s6/s6-battery.sh \
#        > dev/agent-workflow/evidence/restart-017rc1/supplement-s6/battery-final.log 2>&1
#
# NOT part of this script (run separately, recorded in the same evidence dir):
#   - verify-zero-core MUST run from the MAIN checkout (the worktree lacks
#     tests/deepseek-harness-test-use):
#       cd /home/user/dsh-plugins/dsh-agent-team
#       node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use
#
# Root-suite debt baseline (commit5 post-merge battery, run 2 — the
# reference set; ANY deviation must be investigated before reporting):
#   10 files failed / 315 passed (325); 21 tests failed / 3968 passed (3989)
#     packages/domain/test/t1-capability-schema.test.ts      9F
#     packages/domain/test/t2-blueprint-hash.test.ts         1F
#     packages/runtime/test/d3-member-identity-context.test.ts 1F
#     packages/runtime/test/p6t1-parallel.test.ts            2F  (load flake; 0-2F)
#     packages/runtime/test/p6t3-mediation.test.ts           5F
#     packages/runtime/test/p6t3-restart.test.ts             2F
#     packages/runtime/test/p8s3b-result-effects.test.ts     file-level (0 test)
#     packages/runtime/test/t12a-b2-child-identity.test.ts   file-level (0 test)
#     packages/runtime/test/t12a-glue-handoff-ports.test.ts  file-level (0 test)
#     packages/tools/test/p6t6-actions.test.ts               1F

set -u
cd "$(git rev-parse --show-toplevel)"
echo "=== S6 battery @ $(date -u +%FT%TZ) tip=$(git rev-parse HEAD) ==="

echo "=== [1/6] typecheck (all) ==="
pnpm typecheck > s6-tc.log 2>&1
TC=$?
tail -4 s6-tc.log
echo "TYPECHECK_EXIT=$TC"

echo "=== [2/6] build (all) ==="
pnpm build > s6-build.log 2>&1
BD=$?
tail -4 s6-build.log
echo "BUILD_EXIT=$BD"

echo "=== [3/6] build:composition (incl. place-dist-glue + check-artifacts A-D) ==="
pnpm build:composition > s6-composition.log 2>&1
CP=$?
tail -4 s6-composition.log
echo "COMPOSITION_EXIT=$CP"

echo "=== [3b/6] check-artifacts-committed (explicit, post-commit gate) ==="
node scripts/check-artifacts-committed.mjs
AR=$?
echo "ARTIFACTS_EXIT=$AR"

echo "=== [4/6] focused runtime suites (activation core + glue + startup fence + d2) ==="
cd packages/runtime
npx vitest run test/team-session-activation.test.ts \
  test/team-session-activation-glue.test.ts \
  test/team-session-startup-fence.test.ts \
  test/d2-s6-ensure-root-live.test.ts > ../s6-focused-runtime.log 2>&1
FR=$?
grep -E "Test Files|Tests  " ../s6-focused-runtime.log | tail -2
echo "FOCUSED_RUNTIME_EXIT=$FR"
cd ..

echo "=== [5/6] focused client suite (S3 characterization spike) ==="
cd packages/client
npx vitest run test/s3-client-generation-spike.test.ts > ../s6-focused-client.log 2>&1
FC=$?
grep -E "Test Files|Tests  " ../s6-focused-client.log | tail -2
echo "FOCUSED_CLIENT_EXIT=$FC"
cd ..

echo "=== [6/6] root full suite (fresh .tmp-fault in the SAME command) ==="
rm -rf packages/testkit/test/.tmp-fault
pnpm test > s6-root-suite.log 2>&1
RT=$?
grep -E "Test Files|Tests  " s6-root-suite.log | tail -2
echo "ROOTTEST_PROCESS_EXIT=$RT"
echo "--- failed file set (debt comparison) ---"
grep -E " ❯ packages/.*test\.(ts|tsx) \(" s6-root-suite.log | sort -u
echo "=== S6 BATTERY DONE ==="
