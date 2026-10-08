#!/usr/bin/env bash
# usage: sweep-one.sh <option>   — deterministic, reset-first, per-option measurement
set -u
cd "$(git rev-parse --show-toplevel)"
OPT="$1"; BASE=d4eb9f39
EV=dev/agent-workflow/evidence/a4-pr7/7-3-decision
rm -f packages/runtime/test/__probe-a473-postflip.test.ts packages/runtime/test/__probe-a473-gates.test.ts
python3 $EV/scripts/apply-option.py $BASE $OPT || { echo "APPLY FAILED $OPT"; exit 1; }

echo "### OPTION $OPT"
echo "-- typecheck (no-bail)"
pnpm -r --no-bail run typecheck 2>&1 | grep -E "error TS" | sed -E 's|^packages/([a-z-]+) typecheck: |\1 |' > $EV/transcripts/TC-$OPT.txt
echo "   errors=$(wc -l < $EV/transcripts/TC-$OPT.txt) files=$(sed -E 's/^([a-z-]+) ([^(]+)\(.*/\1 \2/' $EV/transcripts/TC-$OPT.txt | sort -u | wc -l) TS2367=$(grep -c TS2367 $EV/transcripts/TC-$OPT.txt) TS2322=$(grep -c TS2322 $EV/transcripts/TC-$OPT.txt)"
cp $EV/probes/probe-postflip-v3-grammar.test.ts packages/runtime/test/__probe-a473-postflip.test.ts
echo "-- post-flip verdict"
rm -rf packages/testkit/test/.tmp-fault
pnpm exec vitest run packages/runtime/test/__probe-a473-postflip.test.ts 2>&1 | grep -E "\[\[PROBE\]\]" | sed 's/^/   /'
echo "-- universe (unpromoted fixtures)"
./dev/agent-workflow/evidence/a4-pr7/7-3-decision/scripts/run-universe.sh $OPT 2>&1 | tail -2 | sed 's/^/   /'
echo "-- promoted family (consent-scope-hash-binding, 19 tests)"
python3 $EV/scripts/promote-fixture.py packages/runtime/test/consent-scope-hash-binding.test.ts | sed 's/^/   promote: /'
rm -rf packages/testkit/test/.tmp-fault
pnpm exec vitest run packages/runtime/test/consent-scope-hash-binding.test.ts > $EV/transcripts/PROMO-$OPT.txt 2>&1
echo "   exit=$? $(grep -E 'Tests |Failed Suites' $EV/transcripts/PROMO-$OPT.txt | tr '\n' ' ')"
grep -m1 -E "AssertionError|TeamContractError|BLUEPRINT_[A-Z_]+" $EV/transcripts/PROMO-$OPT.txt | sed 's/^/   first-error: /'
rm -f packages/runtime/test/__probe-a473-postflip.test.ts
