#!/usr/bin/env bash
# FINAL-BATTERY at tip. Strictly sequential; every instrument prints its own
# verdict line into raw/battery.log so the record is one artefact, not chat.
set -u
EV=dev/agent-workflow/evidence/a4-pr7/compat-atomic
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
LOG=$EV/raw/battery.log
: > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }

say "=== 0. tree identity"
git rev-parse HEAD | tee -a "$LOG"
git status --porcelain | wc -l | sed 's/^/porcelain lines: /' | tee -a "$LOG"

say "=== 1. nine-root census (identity sets, not counts)"
rm -rf packages/testkit/test/.tmp-fault
npx vitest run --reporter=json --outputFile=$EV/scratch/census-tip.json > $EV/raw/census-tip-vitest.log 2>&1
say "vitest census rc=$? ($(grep -E 'Test Files' $EV/raw/census-tip-vitest.log | tail -1))"
node scripts/fail-set.mjs capture $EV/scratch/census-tip.json --out $EV/census-tip-identities.txt >> "$LOG" 2>&1
say "census-tip identities: $(wc -l < $EV/census-tip-identities.txt) (base: $(wc -l < $EV/census-base-identities.txt))"
say "--- fail-set diff base->tip"
node scripts/fail-set.mjs diff $EV/census-base-identities.txt $EV/census-tip-identities.txt 2>&1 | tee -a "$LOG"

say "=== 2. determinism loops (20 sequential solo runs each)"
bash $EV/runloop.sh 20 final-p6t1parallel packages/runtime/test/p6t1-parallel.test.ts $EV/final-p6t1parallel-transcript.txt | tee -a "$LOG"
bash $EV/runloop.sh 20 final-spec packages/runtime/test/a4-compat-atomic-state.test.ts $EV/final-spec-transcript.txt | tee -a "$LOG"

say "=== 3. the frozen gate + the scan-count leg"
npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts packages/testkit/test/p4t6-session-event-scan.test.ts 2>&1 | grep -E "Tests |Test Files|×" | tee -a "$LOG"

say "=== 4. typecheck / lint / lint-identities"
pnpm --no-bail -r run typecheck > $EV/raw/typecheck-tip.log 2>&1
say "typecheck rc=$? errorTS=$(grep -c 'error TS' $EV/raw/typecheck-tip.log)"
pnpm run lint > $EV/raw/lint-tip.log 2>&1
say "lint rc=$? $(grep -E 'problems' $EV/raw/lint-tip.log | tail -1)"
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt > $EV/raw/lint-identities-tip.txt 2>&1
say "lint-identities: $(tail -1 $EV/raw/lint-identities-tip.txt)"

say "=== 5. committed build matches this commit"
pnpm check:artifacts:head > $EV/raw/check-artifacts-head-tip.log 2>&1
say "check:artifacts:head rc=$? $(grep 'DSH-ARTIFACT-VERDICT' $EV/raw/check-artifacts-head-tip.log | tail -1)"

say "=== 6. blueprint-version cleanliness (run from the toplevel, after git add)"
node scripts/verify-blueprint-version-clean.mjs > $EV/raw/blueprint-version-tip.log 2>&1
say "verify-blueprint rc=$? verdict=$(grep -oE 'verdict: [a-z-]+' $EV/raw/blueprint-version-tip.log | tail -1) offending=$(grep -c 'OFFENDING' $EV/raw/blueprint-version-tip.log)"
say "this lane's files named there: $(grep -cE 'a4-compat-atomic-state|compat-atomic|repositories/compatibility|compatibility/probe|compatibility/authority' $EV/raw/blueprint-version-tip.log)"

say "=== 7. assertion-count discipline (base -> tip, no silent removals)"
rm -rf .tmp-basecheck && mkdir -p .tmp-basecheck
git archive 606a0be7 | tar -x -C .tmp-basecheck
base=$(grep -rho 'expect(' --include='*.ts' --include='*.mjs' --include='*.js' .tmp-basecheck/packages .tmp-basecheck/tests 2>/dev/null | wc -l)
basefiles=$(grep -rl 'expect(' --include='*.ts' --include='*.mjs' --include='*.js' .tmp-basecheck/packages .tmp-basecheck/tests 2>/dev/null | wc -l)
tip=$(grep -rho 'expect(' --include='*.ts' --include='*.mjs' --include='*.js' packages tests 2>/dev/null | wc -l)
tipfiles=$(grep -rl 'expect(' --include='*.ts' --include='*.mjs' --include='*.js' packages tests 2>/dev/null | wc -l)
say "expect( base=$base in $basefiles files; tip=$tip in $tipfiles files"
rm -rf .tmp-basecheck
say "=== battery done"
