#!/usr/bin/env bash
# runloop.sh N LABEL OUTDIR TRANSCRIPT — N sequential solo vitest runs of one
# spec file, `rm -rf packages/testkit/test/.tmp-fault` before each, one line per
# run in the transcript, full vitest output per run in raw/. Strictly sequential:
# no `&`, no `-P`, no overlap (the p6t1-flake lane's measurement protocol).
set -u
N="$1"; LABEL="$2"; FILE="$3"; TRANSCRIPT="$4"
EV=dev/agent-workflow/evidence/a4-pr7/compat-atomic
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
: > "$TRANSCRIPT"
fails=0
for i in $(seq 1 "$N"); do
  rm -rf packages/testkit/test/.tmp-fault
  start=$(date -u +%H:%M:%S.%3N)
  npx vitest run "$FILE" > "$EV/raw/$LABEL-$(printf '%02d' "$i").log" 2>&1
  rc=$?
  end=$(date -u +%H:%M:%S.%3N)
  line=$(grep -E 'Test Files.*(passed|failed)' "$EV/raw/$LABEL-$(printf '%02d' "$i").log" | tail -1)
  reds=$(grep -cE '^\s+× ' "$EV/raw/$LABEL-$(printf '%02d' "$i").log")
  echo "run $i rc=$rc wall=$start..$end redlegs=$reds | $line" >> "$TRANSCRIPT"
  if [ "$rc" -ne 0 ]; then fails=$((fails+1)); fi
done
echo "TOTAL $LABEL: $fails failed runs of $N" >> "$TRANSCRIPT"
echo "TOTAL $LABEL: $fails failed runs of $N"
