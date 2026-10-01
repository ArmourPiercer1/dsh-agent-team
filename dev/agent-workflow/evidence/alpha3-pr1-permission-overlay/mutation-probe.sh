#!/usr/bin/env bash
# Guard-effectiveness (mutation) probe for the Alpha.3 PR1 persistence-boundary
# CAS. Each probe weakens ONE guard in the durable append, runs the specs that
# are supposed to catch it, and then the pristine source is restored and
# byte-verified. This is evidence that the CAS/immutability specs actually
# bite — not evidence about the shipped code.
set -uo pipefail
cd "$(dirname "$0")/../../../.." || exit 1
SRC=packages/storage/repositories/permission-overlays.ts
EV=dev/agent-workflow/evidence/alpha3-pr1-permission-overlay
BAK=$EV/permission-overlays.ts.pristine
cp "$SRC" "$BAK"
BEFORE=$(sha256sum "$SRC" | cut -d' ' -f1)
SPECS="packages/runtime/test/permission-overlay-generation-conflict.test.ts packages/runtime/test/permission-overlay-history-immutability.test.ts"

run_probe () {
  local name="$1"; shift
  echo "===== PROBE: $name ====="
  node_modules/.bin/vitest run $SPECS 2>&1 | grep -E "^\s+(✓|×)|Tests  " | sed 's/^/  /'
  cp "$BAK" "$SRC"
}

# Probe 1 — drop the occupied-generation conflict (silent overwrite).
perl -0pi -e "s/      throw this\.#conflict\('generation-conflict', key, snapshot, existing\)\n/      \/\/ MUTATION PROBE 1: no conflict, fall through to overwrite\n/" "$SRC"
grep -q "MUTATION PROBE 1" "$SRC" || { echo "probe 1 patch did not apply"; cp "$BAK" "$SRC"; exit 1; }
run_probe "occupied generation no longer conflicts (overwrite allowed)"

# Probe 2 — drop the predecessor-durability check (gaps become legal).
perl -0pi -e "s/      if \(this\.#readRow\(expectedPrevious\) === undefined\) \{\n        throw this\.#conflict\('predecessor-not-durable', key, snapshot, undefined, \{\n          expectedPreviousSnapshotId: expectedPrevious,\n        \}\)\n      \}\n/      \/\/ MUTATION PROBE 2: predecessor durability not checked\n/" "$SRC"
grep -q "MUTATION PROBE 2" "$SRC" || { echo "probe 2 patch did not apply"; cp "$BAK" "$SRC"; exit 1; }
run_probe "predecessor durability not checked (chain gaps legal)"

# Probe 3 — drop the durable-head check (a late writer may write below the head).
perl -0pi -e "s/    if \(head === undefined \? generation !== 1 : head\.metadata\.generation !== generation - 1\) \{/    if (false \&\& (head === undefined ? generation !== 1 : head.metadata.generation !== generation - 1)) { \/\/ MUTATION PROBE 3/" "$SRC"
grep -q "MUTATION PROBE 3" "$SRC" || { echo "probe 3 patch did not apply"; cp "$BAK" "$SRC"; exit 1; }
run_probe "durable-head check disabled (writes below the head legal)"

AFTER=$(sha256sum "$SRC" | cut -d' ' -f1)
echo "===== restore verification ====="
echo "pristine sha256: $BEFORE"
echo "restored sha256: $AFTER"
[ "$BEFORE" = "$AFTER" ] && echo "RESTORE: byte-identical" || echo "RESTORE: MISMATCH"
rm -f "$BAK"
