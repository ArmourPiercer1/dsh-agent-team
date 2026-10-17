#!/usr/bin/env bash
# a5p3f-loop — RED-rig for the PoC3 leg-E(fd) label drift (shape ②).
#
# Habitat: the controlled-fs LANE suite run from the same root, in a process
# that also runs `test/zz-rig-fdchurn.test.ts` — a sibling FILE hammering
# open()/close() for the whole run. vitest's threads pool runs files as worker
# threads of ONE process and worker threads share the fd table, which is the
# exact condition the nine-root census creates (see census-LOAD RACE FAMILY in
# evidence/a4-pr7/population-baseline/nine-root-319a60d7.md).
# PAR concurrent runs add CPU contention, which widens the close->/proc-check
# window — the CI-load effect.
set -u
LANE=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-poc3-flake/packages/runtime/controlled-fs
VITEST=/srv/workspace/dsh-plugins/dsh-agent-team/node_modules/.bin/vitest
OUT=${OUT:-/srv/workspace/dsh-plugins/dsh-agent-team/.tmp-poc3-flake/loopout}
ITER=${1:-20}
PAR=${2:-4}
LABEL=${3:-run}
mkdir -p "$OUT"
shape2=0; shape291=0; other=0
for ((r = 1; r <= ITER; r += PAR)); do
  pids=()
  for ((p = 0; p < PAR && r + p <= ITER; p++)); do
    (
      cd "$LANE" || exit 9
      timeout 180 "$VITEST" run >"$OUT/raw-$LABEL-r$((r + p)).txt" 2>&1
    ) &
    pids+=("$!")
  done
  wait "${pids[@]}"
  for ((p = 0; p < PAR && r + p <= ITER; p++)); do
    f="$OUT/raw-$LABEL-r$((r + p)).txt"
    if grep -q "expected 'fd-recycled' to be 'fd-closed'" "$f" 2>/dev/null; then
      cp "$f" "$OUT/FAIL-$LABEL-r$((r + p))-SHAPE2-261.txt"
      shape2=$((shape2 + 1)); echo "HIT r$((r + p)) SHAPE2-261"
    elif grep -q "expected -1 to be" "$f" 2>/dev/null; then
      cp "$f" "$OUT/FAIL-$LABEL-r$((r + p))-MIRROR-291.txt"
      shape291=$((shape291 + 1)); echo "HIT r$((r + p)) MIRROR-291"
    elif grep -q "Failed Tests\|Failed Suites" "$f" 2>/dev/null; then
      cp "$f" "$OUT/FAIL-$LABEL-r$((r + p))-OTHER.txt"
      other=$((other + 1)); echo "HIT r$((r + p)) OTHER"
    else
      rm -f "$f"
    fi
  done
done
echo "SUMMARY label=$LABEL rounds=$ITER par=$PAR SHAPE2-261=$shape2 MIRROR-291=$shape291 OTHER=$other"
