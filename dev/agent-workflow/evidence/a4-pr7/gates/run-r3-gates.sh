set -x
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7c
export CI=true XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache XDG_DATA_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/data XDG_CONFIG_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/config
G=dev/agent-workflow/evidence/a4-pr7/gates
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts > $G/r3-p4t6.txt 2>&1; echo "p4t6 exit $?"
npx vitest run packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts packages/runtime/test/a3p3-governance-lane-hygiene.test.ts > $G/r3-a4pr0a-hygiene.txt 2>&1; echo "a4pr0a+hygiene exit $?"
pnpm --filter @dsh-agent-team/client run test > $G/r3-client.txt 2>&1; echo "client exit $?"
node scripts/lint-identities.mjs > $G/r3-lint-identities.txt 2>&1; echo "lint scan exit $?"
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt > $G/r3-lint-diff.txt 2>&1; echo "lint diff exit $?"
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run > $G/r3-final-runA.txt 2>&1; echo "final runA exit $?"
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run > $G/r3-final-runB.txt 2>&1; echo "final runB exit $?"
echo ALLDONE
