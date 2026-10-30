#!/usr/bin/env bash
# p2-corotate.sh — P2: ONE real Host world boot (x3, budget line BEFORE the
# spawn, same probe discipline as P0) in xval-a WHILE the light C1 set
# (node --test pair) runs in xval-b. The probe holds the world up (readiness
# re-probed) until the C1 run writes its marker; C1 timing under co-rotation
# is recorded with the SAME measure.mjs row schema as the P1 baselines.
# Consumes exactly ONE budget line (x3).
set -uo pipefail
EV=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7r3-xval/dev/agent-workflow/evidence/u7r3-xval-20261030
PROBE="$EV/probes/xval-boot-probe.mjs"
BUDGET="$EV/host-start-budget.jsonl"
MARKER="$EV/logs/p2-c1-done.marker"
rm -f "$MARKER"

# Start the host probe FIRST (its budget line + spawn precede the C1 spawn).
node "$PROBE" \
  --worktree /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-a \
  --line xvalc --out "$EV/x3" --budget "$BUDGET" --token x3 --phase p2-corotate \
  --hold-until "$MARKER" --rendezvous "$EV/logs/rendezvous-p2" \
  --rendezvous-timeout-ms 300000 \
  > "$EV/logs/p2-x3.log" 2>&1 &
X3=$!

# wait for x3 world readiness (up file written) — boot must succeed to proceed
for i in $(seq 1 240); do [ -f "$EV/logs/rendezvous-p2/x3.up.json" ] && break; sleep 1; done
if [ ! -f "$EV/logs/rendezvous-p2/x3.up.json" ]; then
  echo "[p2 $(date -u +%FT%TZ)] x3 never came up — recording blocker, NOT retrying (same-class-failure law)"
  wait $X3; echo "x3 exit=$?"; exit 1
fi
echo "[p2 $(date -u +%FT%TZ)] x3 world up; launching light C1 pair under co-rotation (measure.mjs mode a-serial mechanics, co-rotated)"

node "$EV/probes/measure.mjs" --mode a-serial --label p2-corotate-a --out-dir "$EV/measure" \
  > "$EV/logs/p2-measure.log" 2>&1
RC=$?
# label the row as co-rotated
node -e '
  const fs=require("fs");const p=process.argv[1];
  const r=JSON.parse(fs.readFileSync(p,"utf8"));
  r.coRotatedWith="host world x3 (u5xvalc) up in xval-a: boot "+JSON.parse(fs.readFileSync(process.argv[2],"utf8")).port;
  fs.writeFileSync(p,JSON.stringify(r,null,2)+"\n");
' "$EV/measure/row-p2-corotate-a.json" "$EV/logs/rendezvous-p2/x3.up.json" || true
touch "$MARKER"
wait $X3; R3=$?
echo "[p2 $(date -u +%FT%TZ)] C1 measure rc=$RC; x3 exit=$R3"
tail -2 "$EV/logs/p2-measure.log"; tail -4 "$EV/logs/p2-x3.log"
