#!/usr/bin/env bash
# Base control for the §7.6 baseline diff: capture the root suite's failing-identity
# set at THIS commit with the lane's two writes removed, so the head capture can be
# attributed. Then restore, then run the outer legs.
set -uo pipefail
W=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-gate
E=$W/dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate
S=/home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch
cd "$W" || exit 1

echo "### B0 pre-state"
git status --porcelain | head -5

echo "### B1 remove the lane's two writes (spec file + p4t6 increment)"
mv packages/testkit/test/a4p7-merge-gate.test.ts "$S/a4p7-merge-gate.test.ts.aside" || exit 1
git stash push -m "7-6-gate-p4t6-increment-aside-for-base-control" -- packages/testkit/test/p4t6-session-event-scan.test.ts
echo "B1 spec present? $(test -e packages/testkit/test/a4p7-merge-gate.test.ts && echo yes || echo no)"
echo "B1 p4t6 clean? $(git status --porcelain packages/testkit/test/p4t6-session-event-scan.test.ts | wc -l) modified line(s)"

echo "### B2 base capture (root suite, same tree, same node_modules)"
npx vitest run --reporter=json --outputFile="$S/root-vitest-76base.json" > "$S/root-vitest-76base.log" 2>&1
echo "B2 vitest exit=$?"
node scripts/fail-set.mjs capture "$S/root-vitest-76base.json" --out "$E/root-identities-76base.txt"

echo "### B3 restore the lane's writes"
git stash pop
mv "$S/a4p7-merge-gate.test.ts.aside" packages/testkit/test/a4p7-merge-gate.test.ts
echo "B3 spec present? $(test -e packages/testkit/test/a4p7-merge-gate.test.ts && echo yes || echo no)"
git status --porcelain | head -5

echo "### B4 attributable diff (base -> head)"
diff "$E/root-identities-76base.txt" "$E/root-identities-76gate.txt" > "$S/base-head.diff"
echo "new=$(grep -c '^>' "$S/base-head.diff") removed=$(grep -c '^<' "$S/base-head.diff")"
grep -E '^[<>]' "$S/base-head.diff" | cut -c1-140

echo "### B5 outer legs"
bash "$S/outer-legs-76.sh"
echo "### all done"
