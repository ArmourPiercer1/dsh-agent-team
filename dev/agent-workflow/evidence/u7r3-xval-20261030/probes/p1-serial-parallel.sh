#!/usr/bin/env bash
# p1-serial-parallel.sh — P1 control: set A (node --test pair, xval-a) and
# set B (targeted vitest u7-9a-fs-mutation-c1, xval-b). Protocol: A alone x2,
# B alone x2, BOTH at once x2. Every row gated on ambient loadavg1 < 3
# (measure.mjs waits and records the wait). All builds/provisioning are DONE
# before measurement; only tests run during measurement.
set -uo pipefail
EV=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7r3-xval/dev/agent-workflow/evidence/u7r3-xval-20261030
M="$EV/probes/measure.mjs"
O="$EV/measure"
mkdir -p "$O"
run() {
  local mode="$1" label="$2"
  echo "[p1 $(date -u +%FT%TZ)] === $label ($mode) ==="
  node "$M" --mode "$mode" --label "$label" --out-dir "$O" 2>&1 | tail -2
}
run a-serial a-serial-1
run a-serial a-serial-2
run b-serial b-serial-1
run b-serial b-serial-2
run a+b     a+b-parallel-1
run a+b     a+b-parallel-2
echo "[p1 $(date -u +%FT%TZ)] all rows done"
ls -la "$O"/row-*.json
