set -x
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7
export CI=true XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache XDG_DATA_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/data XDG_CONFIG_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/config
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts > .scratch/gates/7-0-p4t6.txt 2>&1; echo "p4t6 exit $?"
npx vitest run packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts packages/runtime/test/a3p3-governance-lane-hygiene.test.ts > .scratch/gates/7-0-a4pr0a-hygiene.txt 2>&1; echo "a4pr0a+hygiene exit $?"
pnpm -r run typecheck > .scratch/gates/7-0-typecheck.txt 2>&1; echo "typecheck exit $?"
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run > .scratch/gates/7-0-root-run1.txt 2>&1; echo "root run1 exit $?"
rm -rf packages/testkit/test/.tmp-fault/
npx vitest run > .scratch/gates/7-0-root-run2.txt 2>&1; echo "root run2 exit $?"
echo ALLDONE
