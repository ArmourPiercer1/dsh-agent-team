#!/usr/bin/env bash
# recorder v3 (runs 4-7): field-keyed identity census, 0.5 s simple sampling.
set -uo pipefail
OUT="$1"; shift
ticks() { awk '{i=index($0,")"); split(substr($0,i+2),a," "); print a[20]}' "/proc/$1/stat" 2>/dev/null; }
ppidof() { awk '{i=index($0,")"); split(substr($0,i+2),a," "); print a[2]}' "/proc/$1/stat" 2>/dev/null; }
echo "=== owned-identity recorder v3 (field-keyed, 0.5s census) ===" > "$OUT"
echo "recorder_pid=$$ recorder_startticks=$(ticks $$) start_utc=$(date -u +%FT%T.%3NZ)" >> "$OUT"
echo "command: $*" >> "$OUT"
"$@" &
CHILD=$!
ch=""; q=$CHILD; while [ -n "$q" ] && [ "$q" != "0" ] && [ "$q" != "1" ]; do ch="$ch$q<-"; q=$(ppidof "$q"); done
echo "direct_child_pid=$CHILD startticks=$(ticks "$CHILD") chain=$ch$$" >> "$OUT"
for i in $(seq 1 3000); do
  kill -0 "$CHILD" 2>/dev/null || break
  declare -A PP=() ST=()
  for dproc in /proc/[0-9]*; do p=${dproc#/proc/}; [ -r "$dproc/stat" ] || continue
    s=$(ticks "$p"); [ -n "$s" ] || continue; PP[$p]=$(ppidof "$p"); ST[$p]=$s; done
  declare -A OWN=([$$]=1); found=1
  while [ "$found" = 1 ]; do found=0
    for p in "${!PP[@]}"; do [ -n "${OWN[$p]:-}" ] && continue; par=${PP[$p]}; [ -n "${OWN[$par]:-}" ] && { OWN[$p]=1; found=1; }
    done; done
  echo "--- census #$i utc=$(date -u +%FT%T.%3NZ) ---" >> "$OUT"
  for p in "${!OWN[@]}"; do
    [ "$p" = "$$" ] && continue
    c2=""; q=$p; n=0; while [ -n "$q" ] && [ "$q" != "0" ] && [ "$q" != "1" ] && [ $n -lt 24 ]; do c2="$c2$q<-"; q=${PP[$q]:-0}; n=$((n+1)); done
    printf 'pid=%s ppid=%s startticks=%s chain=%s :: %s\n' "$p" "${PP[$p]}" "${ST[$p]}" "$c2" "$(tr '\0\n' '  ' < "/proc/$p/cmdline" 2>/dev/null | head -c 110)" >> "$OUT" 2>/dev/null
  done
  sleep 0.5
done
wait "$CHILD"; RC=$?
echo "paired_exit=$RC recorder_end_utc=$(date -u +%FT%T.%3NZ)" >> "$OUT"
exit $RC
