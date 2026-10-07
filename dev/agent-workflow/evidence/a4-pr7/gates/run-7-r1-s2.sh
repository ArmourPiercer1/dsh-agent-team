#!/usr/bin/env bash
# A4-PR7 — post-forward-port gates on the merged tree (merge commit only, no production
# change of ours). Whole-repo test runs are serial; the worktree holds no mutation.
set -u
WT=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7b
OUT=/home/user/dsh-plugins/dsh-agent-team/.tmp-a4pr7b-hold/s2
cd "$WT" || exit 1
F=$OUT/post-merge.txt
{
  echo "=== A4-PR7 #103 — gates re-run on the merged tree. HEAD: $(git rev-parse HEAD)"
  echo "=== date: $(date -u +%FT%TZ)   merged origin/master = $(git rev-parse --short origin/master)"
  echo "########## pnpm -r run typecheck ##########"
  pnpm -r run typecheck 2>&1
  echo "[typecheck exit=$?]"
  echo "########## whole-repo pnpm test (after clearing .tmp-fault) ##########"
  rm -rf packages/testkit/test/.tmp-fault/
  pnpm test 2>&1
  echo "[full-test exit=$?]"
  echo "########## p4t6 (from repo root) ##########"
  pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts 2>&1
  echo "[p4t6 exit=$?]"
  echo "########## a4pr0a (from repo root) ##########"
  pnpm exec vitest run packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts 2>&1
  echo "[a4pr0a exit=$?]"
  echo "########## the ruling lane ##########"
  pnpm exec vitest run packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts 2>&1
  echo "[ruling-lane exit=$?]"
  echo "########## lint identities vs the recorded baseline ##########"
  npm_config_loglevel=error npm_config_update_notifier=false node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt 2>&1
  echo "[lint-diff exit=$?]"
  echo "########## client lane ##########"
  pnpm --filter @dsh-agent-team/client run test 2>&1
  echo "[client exit=$?]"
  echo "########## pnpm run check:artifacts ##########"
  pnpm run check:artifacts 2>&1
  echo "[check:artifacts exit=$?]"
} > "$F" 2>&1
echo "gates -> $F"
