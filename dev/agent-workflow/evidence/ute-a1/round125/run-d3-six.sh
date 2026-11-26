#!/usr/bin/env bash
# ROUND 125 — the six-run d3 protocol (three runs per host, two boots each),
# followed by the negative control on both hosts. Every run's console output and
# its agreement/counters/inflight-block evidence are preserved under
# dev/agent-workflow/evidence/ute-a1/round125/.
set -u
cd "$(dirname "$0")/../../../../.." || exit 1
ROOT="$(pwd)"
OUT="dev/agent-workflow/evidence/ute-a1/round125"
DRIVER="tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs"
mkdir -p "$OUT/runs" "$OUT/controls"
: > "$OUT/runs/SUMMARY.txt"

for host in legacy next; do
  for i in 1 2 3; do
    tag="${host}-run${i}"
    dir="$OUT/runs/$tag"
    mkdir -p "$dir"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] START $tag" | tee -a "$OUT/runs/SUMMARY.txt"
    env TEAM_TEST_HOST="$host" node "$DRIVER" > "$dir/console.log" 2>&1
    code=$?
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] END $tag exit=$code" | tee -a "$OUT/runs/SUMMARY.txt"
    cp -f dev/agent-workflow/evidence/d-boot-feasibility/d3/agreement.txt "$dir/agreement.txt" 2>/dev/null
    cp -f dev/agent-workflow/evidence/d-boot-feasibility/d3/agreement.json "$dir/agreement.json" 2>/dev/null
    for b in boot01 boot02; do
      cp -f "dev/agent-workflow/evidence/d-boot-feasibility/d3/runs/$b/counters.json" "$dir/$b-counters.json" 2>/dev/null
      cp -f "dev/agent-workflow/evidence/d-boot-feasibility/d3/runs/$b/inflight-block.json" "$dir/$b-inflight-block.json" 2>/dev/null
      cp -f "dev/agent-workflow/evidence/d-boot-feasibility/d3/runs/$b/crash.json" "$dir/$b-crash.json" 2>/dev/null
    done
    {
      echo "== $tag exit=$code"
      grep -E "blocking window|in-flight settlement|SIGKILL|RESULT|case d3:crash|FAILED at" "$dir/console.log" 2>/dev/null | tail -20
    } | tee -a "$OUT/runs/SUMMARY.txt"
  done
done

for host in legacy next; do
  tag="negative-${host}"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] START $tag" | tee -a "$OUT/runs/SUMMARY.txt"
  env TEAM_TEST_HOST="$host" A5SF_D3_INFLIGHT_MODE=fast node "$DRIVER" --expect-inflight-refusal > "$OUT/controls/$tag.log" 2>&1
  code=$?
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] END $tag exit=$code" | tee -a "$OUT/runs/SUMMARY.txt"
  cp -f dev/agent-workflow/evidence/d-boot-feasibility/d3/controls/negative-inflight-refusal.json "$OUT/controls/$tag.json" 2>/dev/null
  {
    echo "== $tag exit=$code"
    grep -E "NEGATIVE CONTROL|control " "$OUT/controls/$tag.log" 2>/dev/null | tail -12
  } | tee -a "$OUT/runs/SUMMARY.txt"
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ALL DONE" | tee -a "$OUT/runs/SUMMARY.txt"
