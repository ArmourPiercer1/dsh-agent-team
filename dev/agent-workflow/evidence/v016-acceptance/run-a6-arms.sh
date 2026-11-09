#!/usr/bin/env bash
set -u
REPO=$(cd "$(dirname "$(readlink -f "$0")")/../../../.." && pwd)
cd "$REPO" || exit 9
BASE=$REPO/dev/agent-workflow/evidence/v016-acceptance
KIT=$REPO/tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs
MASTER=$BASE/a6-arms.log
: > "$MASTER"
pick() {
  python3 - "$1" <<'PY'
import socket,sys
lo,hi=[int(x) for x in sys.argv[1].split('-')]
for port in range(lo,hi+1):
    s=socket.socket()
    try:
        s.bind(('127.0.0.1',port)); print(port); s.close(); break
    except OSError:
        s.close()
PY
}
run() {
  local name=$1 hp=$2 mp=$3; shift 3
  local dir=$BASE/a6-$name
  rm -rf "$dir"
  printf '=== %s %s host=%s mock=%s\n' "$name" "$(date -u +%FT%TZ)" "$hp" "$mp" >> "$MASTER"
  env C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 "$@" node "$KIT" --host-port "$hp" --mock-port "$mp" --evidence-dir "$dir" > "$BASE/a6-$name.stdout.log" 2>&1
  local code=$?
  local fails
  fails=$(grep -c 'FAIL A6' "$dir/run.log" 2>/dev/null); [ -z "$fails" ] && fails=0
  printf -- '--- %s exit=%s FAILlines=%s\n' "$name" "$code" "$fails" >> "$MASTER"
  grep 'FAIL A6' "$dir/run.log" 2>/dev/null | cut -c1-400 | sed 's/^/    /' >> "$MASTER"
  grep 'PASS A6-27' "$dir/run.log" 2>/dev/null | tail -1 | cut -c1-400 | sed 's/^/    last: /' >> "$MASTER"
}
# exception r2 already measured manually (a6-exception-r2)
run stop-r1 $(pick 3161-3179) $(pick 3480-3499) C1_A6_STOP=1
run stop-r2 $(pick 3161-3179) $(pick 3480-3499) C1_A6_STOP=1
run crash-r1 $(pick 3161-3179) $(pick 3480-3499) C1_A6_CRASH=1
run crash-r2 $(pick 3161-3179) $(pick 3480-3499) C1_A6_CRASH=1
run inbox-r1 $(pick 3161-3179) $(pick 3480-3499) C1_A6_INBOX=1
run inbox-r2 $(pick 3161-3179) $(pick 3480-3499) C1_A6_INBOX=1
run unclaimed-r1 $(pick 3161-3179) $(pick 3480-3499) C1_A6_INBOX_UNCLAIMED=1
run unclaimed-r2 $(pick 3161-3179) $(pick 3480-3499) C1_A6_INBOX_UNCLAIMED=1
echo "ALL ARMS DONE $(date -u +%FT%TZ)" >> "$MASTER"
