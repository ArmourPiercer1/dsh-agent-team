#!/usr/bin/env bash
# runloop.sh <label> <n> -- strictly sequential solo-run loop for the p6t1 family.
#
# One experiment run = one `vitest run <file>` invocation, preceded by
#   rm -rf packages/testkit/test/.tmp-fault
# Exactly ONE vitest process may exist at a time: the loop is a plain `for`
# with no `&`, no xargs -P, no parallelism. Overlap is invisible to `ps`
# across tool calls in this harness, so the loop also records the wall time of
# every run: the overlap signature is a sudden total-time blow-up, which is
# visible in the per-run real-time column.
set -u
label="$1"
n="$2"
file="${3:-packages/runtime/test/p6t1-parallel.test.ts}"
root="$(git rev-parse --show-toplevel)"
cd "$root" || exit 1
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
ev="dev/agent-workflow/evidence/a4-pr7/p6t1-flake"
raw="$ev/raw"
mkdir -p "$raw"
transcript="$ev/${label}-transcript.txt"
{
  echo "# loop label=$label n=$n file=$file"
  echo "# host=$(uname -srm) node=$(node -v) date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# head=$(git rev-parse HEAD) dirty=$(git status --porcelain | wc -l)"
  echo "# one run = rm -rf packages/testkit/test/.tmp-fault && vitest run <file>, strictly sequential"
  printf '%-6s %-8s %-10s %-9s %-7s %s\n' run result pass fail real_s total_ms note
} > "$transcript"
fails=0
for i in $(seq 1 "$n"); do
  log="$raw/${label}-$(printf '%02d' "$i").log"
  rm -rf packages/testkit/test/.tmp-fault
  t0=$(date +%s.%N)
  npx vitest run "$file" > "$log" 2>&1
  rc=$?
  t1=$(date +%s.%N)
  real=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", b-a}')
  npass=$(sed -nE 's/^[[:space:]]*Tests[[:space:]]+([0-9]+) passed.*/\1/p' "$log" | tail -1)
  nfail=$(sed -nE 's/.*Tests[[:space:]]+[0-9]+ passed[[:space:]]+\|[[:space:]]*([0-9]+) failed.*/\1/p' "$log" | tail -1)
  [ -z "$npass" ] && npass=$(sed -nE 's/^[[:space:]]*Tests[[:space:]]+[0-9]+ passed \(([0-9]+)\).*/\1/p' "$log" | tail -1)
  [ -z "$nfail" ] && nfail=$(sed -nE 's/.*Tests[[:space:]]+.*[[:space:]]\|([[:space:]]*)?([0-9]+) failed.*/\2/p' "$log" | tail -1)
  [ -z "$npass" ] && npass='?'
  [ -z "$nfail" ] && nfail='0'
  if [ "$rc" -eq 0 ]; then res=PASS; else res=FAIL; fails=$((fails+1)); nfail_note="see log"; fi
  tot=$(sed -nE 's/.*Duration[[:space:]]+([0-9]+)ms.*/\1/p' "$log" | tail -1)
  [ -z "$tot" ] && tot='?'
  printf '%-6s %-8s %-10s %-9s %-7s %s\n' "$i" "$res" "$npass" "$nfail" "$real" "vitest_total_ms=$tot rc=$rc" >> "$transcript"
done
{
  echo "# RESULT $label: failures/$n = $fails/$n"
  echo "# end=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$transcript"
echo "$label failures/$n = $fails/$n  (transcript: $transcript)"
