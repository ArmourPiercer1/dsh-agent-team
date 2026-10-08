#!/usr/bin/env bash
# loadprobe.sh <label> <n> — same solo-run protocol as runloop.sh, but with N
# CPU burners competing for the whole window. This is the condition under which
# the family was historically dismissed as "the load flake": if the green was a
# sample, it should break here.
set -u
label="$1"; n="$2"; cores=$(nproc)
ev="dev/agent-workflow/evidence/a4-pr7/p6t1-flake"
for i in $(seq 1 $((cores))); do yes > /dev/null & done
burners=$(jobs -p | tr '\n' ' ')
echo "# load label=$label burners=$burners" >> "$ev/${label}-transcript.txt"
bash "$ev/runloop.sh" "$label" "$n"
for p in $burners; do kill "$p" 2>/dev/null; done
