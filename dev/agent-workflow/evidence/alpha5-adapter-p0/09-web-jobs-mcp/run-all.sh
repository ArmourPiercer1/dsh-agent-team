#!/usr/bin/env bash
# run-all.sh — Alpha.5 P0-9 web/jobs/MCP fixture battery (idempotent).
# Writes p09-<family>-run.log next to the runners; exit = max of runner exits
# (0 all green; 1 an assertion failed; 2 environment).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
cd "$REPO" || exit 2
overall=0
for fam in web jobs mcp; do
  echo "== p09-$fam =="
  node "dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-$fam-runner.mjs" \
    > "dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-$fam-run.log" 2>&1
  code=$?
  echo "   exit=$code  log=p09-$fam-run.log"
  tail -n 2 "dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-$fam-run.log" | sed 's/^/   | /'
  [ "$code" -gt "$overall" ] && overall=$code
done
# post-run hygiene probes: loopback ports must be free, no mock children, pinned tree clean
echo "== hygiene =="
python3 - <<'PY'
import socket
for p in (3187, 3188):
    s = socket.socket(); r = s.connect_ex(('127.0.0.1', p)); print(f"port {p}: {'OCCUPIED(LEAK!)' if r == 0 else 'FREE'}"); s.close()
PY
pgrep -f "p09-mcp-mock-server\.mjs" >/dev/null 2>&1 && echo "mock children: PRESENT(LEAK!)" || echo "mock children: none"
T="$(cd "$REPO/tests/deepseek-harness-test-use" && pwd)"
echo "test-use HEAD=$(git -C "$T" rev-parse HEAD) porcelain=$(git -C "$T" status --porcelain | wc -l) lines"
echo "OVERALL_EXIT=$overall"
exit "$overall"
