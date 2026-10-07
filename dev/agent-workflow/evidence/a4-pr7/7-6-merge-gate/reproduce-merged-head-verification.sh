#!/usr/bin/env bash
set -uo pipefail
. /home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/clsx-env.sh
W=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-gate
E=$W/dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate
cd "$W" || exit 1
echo "### V1 the gate, run A (determinism check is V2)"
npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|Duration|×"
echo "### V2 the gate, run B"
npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|Duration|×"
echo "### V3 p4t6"
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |×"
echo "### V4 the 7.5 composition classifier suite"
npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |×"
echo "### V5 typecheck, whole workspace"
pnpm -r run typecheck > /tmp/tc.txt 2>&1; echo "pnpm -r run typecheck exit=$?"
echo "Done lines: $(grep -c 'typecheck: Done' /tmp/tc.txt)   error TS lines: $(grep -c 'error TS' /tmp/tc.txt)   Failed: $(grep -c 'typecheck: Failed' /tmp/tc.txt)"
echo "### V6 eslint on the changed file, then full repo lint"
npx eslint packages/testkit/test/a4p7-merge-gate.test.ts packages/testkit/test/p4t6-session-event-scan.test.ts 2>&1 | grep -v "npm warn" | tail -2; echo "changed-file eslint exit=${PIPESTATUS[0]}"
pnpm run lint > /tmp/lint.txt 2>&1; echo "pnpm run lint exit=$?"; grep -vE "npm warn|^$" /tmp/lint.txt | tail -3
echo "### V7 lint-identities --diff against the named baseline"
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt 2>&1 | tail -2
echo "### V8 composition-smoke, exit code measured WITHOUT A PIPE"
node scripts/composition-smoke.mjs > /tmp/cs.txt 2>&1
CS=$?
echo "exit_code_no_pipe=$CS"
echo "step lines: $(grep -cE '^(PASS|FAIL|SKIP) ' /tmp/cs.txt)  SKIP lines: $(grep -cE '^SKIP ' /tmp/cs.txt)  FAIL lines: $(grep -cE '^FAIL ' /tmp/cs.txt)"
echo "footer: $(grep -E '^(PASS|FAIL) composition-smoke' /tmp/cs.txt)"
echo "### V9 acceptance suite (root-suite content, reported not embedded)"
npx vitest run packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |×"
echo "### V10 the fence at the toplevel (RESULT lines), exit without a pipe"
node scripts/verify-blueprint-version-clean.mjs > /tmp/fence.txt 2>&1; echo "fence exit=$?"; grep -E "^(RESULT|scanned-in-scope)" /tmp/fence.txt
echo "### V11 tree state"
git status --porcelain
echo "### done"
