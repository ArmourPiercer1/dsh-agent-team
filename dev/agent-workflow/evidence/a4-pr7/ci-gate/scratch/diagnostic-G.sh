#!/usr/bin/env bash
# DIAGNOSTIC G — separate "the assertion changed" from "the 5000 ms default budget was crossed".
#
# The full gate refused the unmodified tip twice on ONE identity, and vitest said
# `Error: Test timed out in 5000ms.` instead of showing an assertion diff. No root or package
# vitest config sets `testTimeout`, so vitest's default 5000 ms is the budget. This script re-runs
# the identical nine-root census with a 20 s budget and grades the report through the SAME grader.
# If the raised-budget capture yields exactly the published 22 identities, the red is a budget
# policy and not a changed assertion set — and the remedy belongs to the leg's owner (give the walk
# the budget it needs, or narrow the walk), never to the gate, which has to keep refusing what it
# actually saw.
set -u
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/ci-a4-pr-gate || exit 2
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/ci-gate
OUT=$EV/scratch/census-raise-timeout.json
{
  echo "=== DIAGNOSTIC G — timeout budget, not assertion set ==="
  echo "start $(date -u +%FT%TZ)   load: $(cut -d' ' -f1-3 /proc/loadavg)   cores: $(nproc)"
  echo "head: $(git rev-parse --short HEAD)"
  echo
  echo "--- the leg's measured wall clock, from the stored reports of earlier captures ---"
  echo "  4589 ms pass  (closure lane @9df5535f, a quieter box, before this lane existed)"
  echo "  4424 ms pass  4094 ms pass  (this lane, run 1, captures 1-2)"
  echo "  4444 ms pass  6938 ms TIMEOUT (this lane, run 2, captures 1-2)"
  echo "  ~7 s  TIMEOUT x2 (this lane, run 3, both captures, load average ~19)"
  echo "So the leg sits at 80-92% of its budget and one busy scheduler decides the verdict."
  echo
  echo "\$ rm -rf packages/testkit/test/.tmp-fault"
  rm -rf packages/testkit/test/.tmp-fault
  echo "\$ pnpm exec vitest run --reporter=json --outputFile.json=$OUT --testTimeout=20000"
  pnpm exec vitest run --reporter=json "--outputFile.json=$OUT" --testTimeout=20000 2>&1 | tail -6
  echo "[vitest exit $? — 1 is EXPECTED: the census carries 22 disclosed reds]"
  echo
  echo "--- that leg's duration under the raised budget ---"
  node -e '
    const r = require("./'"$OUT"'")
    for (const f of r.testResults) {
      if (!f.name.includes("a3p3-governance-lane-hygiene")) continue
      for (const a of f.assertionResults) {
        if (!(a.fullName || "").includes("ONE audited consumer set per name")) continue
        console.log("  status:", a.status, " duration:", Math.round(a.duration ?? -1), "ms")
      }
    }
    const bad = r.testResults.filter((f) => f.status === "failed").length
    console.log("  files failed:", bad, "of", r.testResults.length, " tests:", r.numFailedTests, "failed /", r.numTotalTests)
  '
  echo
  echo "\$ node scripts/ci-pr-gate.mjs --only census --census-json $OUT"
  node scripts/ci-pr-gate.mjs --only census --census-json "$OUT"
  echo "[grade exit $? — 0 means the 20 s capture's identity set IS the published 22]"
  date -u +"end %FT%TZ"
} 2>&1
