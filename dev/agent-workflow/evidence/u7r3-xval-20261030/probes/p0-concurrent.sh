#!/usr/bin/env bash
# p0-concurrent.sh — the P0 CORE: boot x1 (xval-a) first, hold it up, boot x2
# (xval-b) while x1 is live, prove both worlds answer at the SAME TIME on
# DISTINCT ports via the SHARED lease root, then tear both down.
#
# BUDGET STATE (see README): line 1 of host-start-budget.jsonl (token x1) was
# CONSUMED by the attempt-1 probe-script crash (real Host boot, RCA'd: a probe
# TypeError after startHost, world reclaimed via reclaimWorld — evidence
# x1/attempt-1-crash/ + measure/lease-race untouched). This run therefore
# writes lines 2 (x1 retry) and 3 (x2) — the ledger caps at exactly 3 lines,
# so the x3 slot is left UNSPENT and the P2 co-rotation is FOLDED IN: while
# BOTH worlds are up (a harsher co-rotation than the single-host variant), the
# light C1 pair (node --test) runs in xval-b via measure.mjs, and the marker
# it writes releases both worlds for teardown. C1 timing under co-rotation is
# compared against its serial baselines (rows a-serial-*).
set -uo pipefail
EV=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7r3-xval/dev/agent-workflow/evidence/u7r3-xval-20261030
PROBE="$EV/probes/xval-boot-probe.mjs"
RD="$EV/logs/rendezvous"
MARKER="$EV/logs/p2-fold-c1-done.marker"
rm -rf "$RD"; rm -f "$MARKER"; mkdir -p "$RD" "$EV/logs"
BUDGET="$EV/host-start-budget.jsonl"

echo "[p0 $(date -u +%FT%TZ)] launch x1-retry (xval-a) — will hold until x2 up AND C1 fold-in done"
node "$PROBE" \
  --worktree /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-a \
  --line xvala --out "$EV/x1" --budget "$BUDGET" --token x1 --phase p0-concurrent-retry-after-probe-bug-rca \
  --rendezvous "$RD" --peer x2 --hold-until "$MARKER" --rendezvous-timeout-ms 900000 \
  > "$EV/logs/p0-x1.log" 2>&1 &
X1=$!

# wait until x1's world is actually up (readiness witness done), THEN spawn x2
for i in $(seq 1 300); do [ -f "$RD/x1.up.json" ] && break; sleep 1; done
[ -f "$RD/x1.up.json" ] || { echo "[p0] FATAL: x1 never came up"; wait $X1; exit 1; }
echo "[p0 $(date -u +%FT%TZ)] x1 up: $(tr -d '\n' < "$RD/x1.up.json" | head -c 160); launching x2 (xval-b) CONCURRENTLY"

node "$PROBE" \
  --worktree /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-b \
  --line xvalb --out "$EV/x2" --budget "$BUDGET" --token x2 --phase p0-concurrent \
  --rendezvous "$RD" --peer x1 --hold-until "$MARKER" --rendezvous-timeout-ms 900000 \
  > "$EV/logs/p0-x2.log" 2>&1 &
X2=$!

for i in $(seq 1 300); do [ -f "$RD/x2.up.json" ] && break; sleep 1; done
[ -f "$RD/x2.up.json" ] || { echo "[p0 $(date -u +%FT%TZ)] WARN: x2 up-file never appeared (its probe may fail alone)"; }

echo "[p0 $(date -u +%FT%TZ)] both worlds up (or x2 failed) — P2 FOLD-IN: light C1 pair in xval-b under the 2-live-hosts window"
node "$EV/probes/measure.mjs" --mode a-serial --label p2-fold-a --out-dir "$EV/measure" > "$EV/logs/p2-fold-measure.log" 2>&1
MRC=$?
node -e '
  const fs=require("fs");
  const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const x1=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  let x2=null; try{x2=JSON.parse(fs.readFileSync(process.argv[3],"utf8"))}catch{}
  r.coRotatedWith={x1:{port:x1.port,world:x1.world},x2:x2?{port:x2.port,world:x2.world}:"x2-not-up"};
  r.coRotationNote="P2 folded into the P0 overlap window (x3 budget slot left unspent; see README budget section). Two live Host worlds + light C1 in xval-b.";
  fs.writeFileSync(process.argv[1],JSON.stringify(r,null,2)+"\n");
' "$EV/measure/row-p2-fold-a.json" "$RD/x1.up.json" "$RD/x2.up.json" 2>/dev/null || true
touch "$MARKER"
echo "[p0 $(date -u +%FT%TZ)] marker written — worlds will finish overlap samples and tear down"

wait $X1; R1=$?
wait $X2; R2=$?
echo "[p0 $(date -u +%FT%TZ)] x1 exit=$R1 x2 exit=$R2 measure rc=$MRC"
tail -3 "$EV/logs/p0-x1.log"; tail -3 "$EV/logs/p0-x2.log"
