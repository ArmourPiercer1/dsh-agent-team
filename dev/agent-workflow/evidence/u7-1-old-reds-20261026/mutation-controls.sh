#!/usr/bin/env bash
# U7-1 / EB2-C mutation controls: prove each re-pinned assertion is NOT vacuous.
# Each control plants ONE wrong value in a product file, runs the affected test
# files, then restores the file byte-exactly (git checkout) — even on failure.
# Product files are never committed modified; the script asserts porcelain on
# exit. Run from the repository (worktree) root.
set -u
OUT=${OUT:-.artifacts/logs/mutation}
mkdir -p "$OUT"
FILES_MSG="packages/runtime/test/p6t3-mediation.test.ts packages/runtime/test/p6t3-restart.test.ts packages/tools/test/p6t6-actions.test.ts"
FILES_T2="packages/domain/test/t2-blueprint-hash.test.ts"
COORD=packages/runtime/messaging/coordinator.ts
MED=packages/runtime/messaging/mediation.ts
VAL=packages/domain/blueprint/src/validate.ts
restore() { git checkout -- "$COORD" "$MED" "$VAL"; }
trap restore EXIT

run() { # label, files...
  local label=$1; shift
  pnpm exec vitest run "$@" > "$OUT/$label.log" 2>&1
  echo "$label exit=$? $(grep -E '^ +Tests ' "$OUT/$label.log" | tr -s ' ')"
  grep -E '^ FAIL ' "$OUT/$label.log" | sed 's/^/  /'
}

# M0 — unmutated control (must be green)
run M0-unmutated $FILES_MSG $FILES_T2

# M1 — revert the leader delivery target to the pre-3be0de1f child session
python3 - "$COORD" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
old="const deliveredToSessionId = isLeaderTarget ? rootSessionId : String(target.childSessionId)"
assert s.count(old)==1; open(p,'w').write(s.replace(old,"const deliveredToSessionId = String(target.childSessionId)"))
PY
run M1-leader-target-child-session $FILES_MSG
restore

# M2 — break the security rule: member→member always direct (grant ignored)
python3 - "$MED" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
old="if (peerDirectGranted(overlays, caller.instanceId)) {"
assert s.count(old)==1; open(p,'w').write(s.replace(old,"if (true || peerDirectGranted(overlays, caller.instanceId)) {"))
PY
run M2-mediation-grant-bypassed $FILES_MSG
restore

# M3 — drop the capabilities key from the hashable template projection
python3 - "$VAL" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
old="""    capabilities:
      template.capabilities === undefined ? null : toHashableCapabilities(template.capabilities),
  }
  // Schema-v2 per-template"""
assert s.count(old)==1; open(p,'w').write(s.replace(old,"""  }
  // Schema-v2 per-template"""))
PY
run M3-hash-capabilities-key-dropped $FILES_T2
restore

# M4 — absent capabilities projected as {} instead of explicit null
python3 - "$VAL" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
old="template.capabilities === undefined ? null : toHashableCapabilities(template.capabilities),"
assert s.count(old)==1; open(p,'w').write(s.replace(old,"template.capabilities === undefined ? {} : toHashableCapabilities(template.capabilities),"))
PY
run M4-hash-capabilities-absent-as-object $FILES_T2
restore

trap - EXIT
echo "porcelain(product files): [$(git status --porcelain -- "$COORD" "$MED" "$VAL")]"
