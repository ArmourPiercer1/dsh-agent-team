#!/usr/bin/env bash
# p06-host-smoke.sh — P0-6 stage1+2a re-runnable host smoke (TEST_METHODS §2 chain).
# Boots the pristine pinned host on port 3183 (avoid 3180/3181/3182 used earlier;
# NEVER :3080), verifies auth gate, mounts the Team-owned observer plugin row via
# the PUBLIC profiles/web/cordis.patch.yml seam, checks it registered inside the
# real host process, then stops the instance. DSH_HOME world stays under
# tests/homes/ (workspace, gitignored). Launch token is redacted from logs.
# Usage: bash p06-host-smoke.sh   (needs prior `pnpm run build` in the checkout)
set -uo pipefail
EV="$(cd "$(dirname "$0")" && pwd)"
W="$(cd "$EV/../../../../.." && pwd)" # 07-integration -> alpha5-adapter-p0 -> evidence -> agent-workflow -> dev -> worktree root
T="$W/tests/deepseek-harness-test-use"
PORT="${P06_PORT:-3183}"
WORLD="$W/tests/homes/a5p0-smoke-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$WORLD/profiles/web"
ROW="file://$EV/02-plugin/p06-observer-plugin.mjs"
printf '# alpha5 P0-6 smoke observation row (public seam only)\n- insert:\n  - id: p06-observer\n    name: %s\n' "$ROW" > "$WORLD/profiles/web/cordis.patch.yml"
LOG="$EV/smoke-$(basename "$WORLD").log"
rm -f "$EV/02-plugin/observation.json"
echo "== $(date -u +%FT%TZ) port=$PORT world=$WORLD"
cd "$T"
timeout 45 env DSH_HOME="$WORLD" P06_OBS_OUT="$EV/02-plugin/observation.json" node apps/cli/lib/bin.js web --port "$PORT" --no-open > "$LOG" 2>&1 &
BPID=$!
for _ in $(seq 1 40); do grep -q 'dsh web:' "$LOG" && break; sleep 1; done
sleep 2
NO_TOKEN=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)
kill "$BPID" 2>/dev/null; wait "$BPID" 2>/dev/null
sed -i -E 's/token=[A-Za-z0-9_-]+/token=<REDACTED>/g' "$LOG"
echo "boot_line=$(grep -c 'dsh web:' "$LOG") no_token_http=$NO_TOKEN (expect 1 and 401)"
echo "observation=$(cat "$EV/02-plugin/observation.json" 2>/dev/null | tr -d '\n')"
echo "test_use_tracked_dirty=$(git -C "$T" status --porcelain | grep -v '^??' | wc -l) test_use_HEAD=$(git -C "$T" rev-parse HEAD)"
[ "$NO_TOKEN" = "401" ] && grep -q '"registered": true' "$EV/02-plugin/observation.json" && echo SMOKE_OK || echo SMOKE_FAIL
