#!/usr/bin/env bash
# ROUND 125 — the local gate block, verbatim, one log per gate under gates/.
set -u
cd "$(dirname "$0")/../../../../.." || exit 1
OUT="dev/agent-workflow/evidence/ute-a1/round125/gates"
mkdir -p "$OUT"
G1_FILES=(
  tests/ute1-fs/native-fs-binding.test.mjs
  tests/ute-g1-fs/lane-suite.test.mjs
  tests/ute-g1-fs/lib/refusal-categories.test.mjs
  tests/ute-g1-fs/product-route-image.test.mjs
  tests/ute-g1-search/lane-suite.test.mjs
  tests/ute-g1-web/lane-suite.test.mjs
  tests/ute-g1-process/lane-suite.test.mjs
  tests/ute-g1-agentctl/lane-suite.test.mjs
  tests/ute-g1-uistate/lane-suite.test.mjs
)

run() {
  name="$1"; shift
  echo "### $name :: $*" | tee -a "$OUT/commands.txt"
  "$@" > "$OUT/gate-$name.log" 2>&1
  code=$?
  echo "### $name exit=$code" | tee -a "$OUT/commands.txt"
  return "$code"
}

run dispatch-ute-vnext-a1-legacy   node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
run test-catalog                   node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
run ute-cut-closure                node scripts/ute-cut-closure.mjs --check
run ute-p0-assets                  node scripts/ute-p0-assets.mjs --check
run docs-sync                      node scripts/docs-sync.mjs --check
run place-dist-glue                node scripts/place-dist-glue.mjs
run eb3-ci-required                node scripts/eb3-ci-required.mjs
run bound-vitest                   node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
run eb3-run-manifest               node scripts/eb3-run-manifest.mjs
run ute-g1-argv                    node --import ./scripts/run-tests-hooks.mjs --test --test-concurrency=1 "${G1_FILES[@]}"
run version-gate-verify-unit       node --test --test-force-exit scripts/version-gate-verify.test.mjs
run ci-pr-gate                     node scripts/ci-pr-gate.mjs --full --census-captures 2
echo "### ALL GATES DONE"
