set -uo pipefail
WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7m-kit
EVID=$WT/dev/agent-workflow/evidence/alpha5/wiring/w7m
cd "$WT"
port_free () { python3 -c "
import socket,sys
s=socket.socket()
try:
    s.bind(('127.0.0.1',$1)); s.close()
except OSError:
    sys.exit(1)
"; }
wait_free () { # $1=port $2=attempts $3=label
  for i in $(seq 1 $2); do
    if port_free "$1"; then echo "[wait] port $1 FREE at $(date -Is) (attempt $i) $3"; return 0; fi
    sleep 5
  done
  echo "[wait] port $1 STILL BUSY after $(( $2 * 5 ))s $3"; return 1
}
echo "[run] $(date -Is) mandated port: 3184 (session-start proof was FREE; a foreign listener appeared mid-prep — recorded, never operated)"
PORT=3184
if ! wait_free 3184 120 "(waiting out the foreign listener)"; then
  # TEST_METHODS: 端口冲突须避让并登记 — pick the first free 3180-family port, record honestly.
  for cand in 3185 3183 3182; do
    if port_free "$cand"; then PORT=$cand; echo "[run] $(date -Is) PORT DEVIATION RECORDED: 3184 stayed busy (foreign instance, read-only probed 401); moving to $cand (3180-family, self-proved free)"; break; fi
  done
  [ "$PORT" != 3184 ] || { echo "[run] no family port free; aborting"; exit 3; }
fi
echo "[run] $(date -Is) RED (--without-row) on :$PORT"
node tests/kits/a5-w7m-m13-domain-veto/a5w7m-kit.mjs --without-row --evidence-dir "$EVID/run-RED" --port "$PORT" > "$EVID/run-RED-console.log" 2>&1
RED_EXIT=$?
echo "[run] $(date -Is) RED exit=$RED_EXIT"
grep -E '(PASS|FAIL) M' "$EVID/run-RED-console.log" | sed 's/^\[[^]]*\] //' || true
wait_free "$PORT" 120 "(between runs)" || exit 3
echo "[run] $(date -Is) GREEN (emit receipt) on :$PORT"
node tests/kits/a5-w7m-m13-domain-veto/a5w7m-kit.mjs --evidence-dir "$EVID/run-GREEN" --port "$PORT" --emit-receipt dev/agent-workflow/evidence/alpha5/pr8/probes/receipts/M-13.receipt.json > "$EVID/run-GREEN-console.log" 2>&1
GREEN_EXIT=$?
echo "[run] $(date -Is) GREEN exit=$GREEN_EXIT port=$PORT"
grep -E '(PASS|FAIL) M' "$EVID/run-GREEN-console.log" | sed 's/^\[[^]]*\] //' || true
tail -3 "$EVID/run-GREEN-console.log"
exit $GREEN_EXIT
