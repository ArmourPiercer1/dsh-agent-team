#!/usr/bin/env bash
set -uo pipefail
W=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-gate
E=$W/dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate
S=/home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch
cd "$W" || exit 1
SPEC=packages/testkit/test/a4p7-merge-gate.test.ts
P4=packages/testkit/test/p4t6-session-event-scan.test.ts

echo "### R1 base capture at ff9218a3 (this lane's writes absent)"
cp "$P4" "$S/p4t6.mine.ts"
git show origin/master:$P4 > "$P4"
mv "$SPEC" "$S/spec.aside.ts"
npx vitest run --reporter=json --outputFile="$S/rv-base.json" > "$S/rv-base.log" 2>&1
echo "R1 vitest exit=$?"
node scripts/fail-set.mjs capture "$S/rv-base.json" --out "$E/root-identities-76base-ff9218a3.txt"
cp "$S/p4t6.mine.ts" "$P4"
mv "$S/spec.aside.ts" "$SPEC"
echo "R1 restored: spec=$(test -e "$SPEC" && echo yes) p4t6diff=$(git status --porcelain -- $P4 | wc -l)"

echo "### R2 head capture (this lane's writes present)"
npx vitest run --reporter=json --outputFile="$S/rv-head.json" > "$S/rv-head.log" 2>&1
echo "R2 vitest exit=$?"
node scripts/fail-set.mjs capture "$S/rv-head.json" --out "$E/root-identities-76head-ff9218a3.txt"

echo "### R3 attributable diff base -> head"
diff "$E/root-identities-76base-ff9218a3.txt" "$E/root-identities-76head-ff9218a3.txt" > "$S/rv.diff"
echo "new=$(grep -c '^>' "$S/rv.diff") removed=$(grep -c '^<' "$S/rv.diff")"
grep -E '^[<>]' "$S/rv.diff" | cut -c1-140

echo "### R4 outer legs on the rebased tree"
bash "$S/outer-legs-76.sh"
echo "### done"
