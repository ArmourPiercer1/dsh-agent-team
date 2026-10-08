#!/usr/bin/env bash
# FINAL BATTERY — lane fix-a4-collection-errors-32 (test-only repair, Alpha.4 / A4-PR7).
#
# Runs EVERY gate the lane owes, in one chain, against the exact working-tree content that
# is about to be committed. Any failed assertion stops the chain BEFORE the commit:
# verification and commit live in one `&&` chain, so a red gate cannot be committed.
#
# Vitest runs are strictly SEQUENTIAL (three other lanes were measuring failure rates on
# this machine; the nine-root census is run EXACTLY ONCE and this battery does NOT re-run
# it — it re-reads the captured artifacts).
set -uo pipefail
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-collection-errors-32
EV=dev/agent-workflow/evidence/a4-pr7/collection-errors
OUT=$EV/FINAL-BATTERY.txt
FAILS=0
say() { echo "$@" | tee -a "$OUT"; }
run() { # run <label> <expected-substring> <cmd...>
  local label=$1 expect=$2; shift 2
  say ""; say "### $label"
  local out; out=$(mktemp)
  "$@" > "$out" 2>&1; local rc=$?
  grep -vE '^\s*$' "$out" | tail -${TAIL:-12} | tee -a "$OUT"
  if grep -qF "$expect" "$out"; then say "    -> ASSERTION OK: output contains [$expect]"; else say "    -> ASSERTION FAILED: output missing [$expect]"; FAILS=$((FAILS+1)); fi
  say "    -> exit=$rc (lint is expected to exit 1: 128 standing errors)"
  rm -f "$out"
}

: > "$OUT"
say "FINAL BATTERY — lane fix-a4-collection-errors-32   $(date -u +%FT%TZ)"
say "base=1d706917  branch=$(git rev-parse --abbrev-ref HEAD)  worktree=$(pwd)"
say "production-source dirty check:"
say "  $(git status --porcelain -- 'packages/*/src' | wc -l) file(s) under packages/*/src dirty (must be 0)"
[ "$(git status --porcelain -- 'packages/*/src' | wc -l)" = "0" ] || FAILS=$((FAILS+1))

# 1. the three repaired files, solo, by identity
rm -rf packages/testkit/test/.tmp-fault
run "vitest — the three repaired files (expect 3 files / 33 legs / 0 failing)" "Tests  33 passed (33)" \
  pnpm exec vitest run packages/runtime/test/p8s3b-result-effects.test.ts \
    packages/runtime/test/t12a-b2-child-identity.test.ts \
    packages/runtime/test/t12a-glue-handoff-ports.test.ts
TAIL=3 pnpm exec vitest run packages/runtime/test/p8s3b-result-effects.test.ts \
  packages/runtime/test/t12a-b2-child-identity.test.ts \
  packages/runtime/test/t12a-glue-handoff-ports.test.ts \
  --reporter=json --outputFile.json=$EV/raw/battery-three-files.json > /dev/null 2>&1
node scripts/fail-set.mjs capture $EV/raw/battery-three-files.json --out $EV/scratch/battery-three-files.ids.txt | tee -a "$OUT"

# 2. the repaired files' neighbourhood (same bridge, same family) — regression screen
rm -rf packages/testkit/test/.tmp-fault
run "vitest — repaired files + their t12a/p8s3 neighbourhood (11 files)" "Tests  82 passed (82)" \
  pnpm exec vitest run packages/runtime/test/p8s3b-result-effects.test.ts \
    packages/runtime/test/t12a-b2-child-identity.test.ts \
    packages/runtime/test/t12a-glue-handoff-ports.test.ts \
    packages/runtime/test/t12a-b3-external-deny.test.ts \
    packages/runtime/test/t12a-h1-nullable-mcp.test.ts \
    packages/runtime/test/t12a-m1-effective-cwd.test.ts \
    packages/runtime/test/t12a-m2-persona.test.ts \
    packages/runtime/test/t12a-m3-recursive-drain.test.ts \
    packages/runtime/test/t12a-team-tools-registration.test.ts \
    packages/runtime/test/p8s3-work-chain.test.ts \
    packages/runtime/test/p8s3-work-request.test.ts

# 3. the off-limits merge gate: run it, expect 29/29, never edit it
rm -rf packages/testkit/test/.tmp-fault
run "vitest — packages/testkit/test/a4p7-merge-gate.test.ts (off-limits; expect 29/29)" "Tests  29 passed (29)" \
  pnpm exec vitest run packages/testkit/test/a4p7-merge-gate.test.ts

# 4. typecheck (every tsconfig includes test/)
run "pnpm --no-bail -r run typecheck" "typecheck: Done" pnpm --no-bail -r run typecheck

# 5. lint: standing 128 errors, not one more
run "pnpm run lint (standing 128 errors / 32 warnings)" "128 errors" pnpm run lint

# 6. lint identities vs the recorded baseline: new 0
run "node scripts/lint-identities.mjs --diff (expect new 0)" "new 0" \
  node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt

# 7. the derived p4t6 total, never quoted stale
say ""; say "### derived p4t6 (scanSessionEventVocabulary filesScanned), measured on this tree"
node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs').then(m=>console.log('    filesScanned='+m.scanSessionEventVocabulary({}).filesScanned))" | tee -a "$OUT"

# 8. assertion arithmetic: grep -c 'expect(' base -> tip, and the removal scan
say ""; say "### grep -c 'expect(' base(1d706917) -> tip"
for f in packages/runtime/test/p8s3b-result-effects.test.ts packages/runtime/test/t12a-b2-child-identity.test.ts packages/runtime/test/t12a-glue-handoff-ports.test.ts; do
  b=$(git show 1d706917:$f | grep -c 'expect('); t=$(grep -c 'expect(' "$f")
  say "  $f base=$b tip=$t delta=$((t-b))"
done
say "  (removal scan recorded in scratch/expect-count.txt: no base assertion is absent at tip)"

# 9. the ONE census, re-read (not re-run)
say ""; say "### the single nine-root census (captured once; this section only re-reads it)"
say "  $(grep -m1 'capturedAt=' $EV/scratch/tip-census.roots.txt)  files=$(sed -n 's/^files=\([0-9]*\).*/\1/p' $EV/scratch/tip-census.roots.txt | head -1)"
sed -n 's/^root /  root /p' $EV/scratch/tip-census.roots.txt | tee -a "$OUT" > /dev/null
node scripts/fail-set.mjs diff \
  /home/user/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/baseline-2162f6a7.ids.txt \
  $EV/scratch/tip-census.ids.txt | tail -6 | tee -a "$OUT"

say ""; say "=============================================================="
if [ "$FAILS" = "0" ]; then say "BATTERY RESULT: ALL GATES OK — safe to commit"; say "==============================================================" ; exit 0
else say "BATTERY RESULT: $FAILS ASSERTION(S) FAILED — DO NOT COMMIT"; say "=============================================================="; exit 1; fi
